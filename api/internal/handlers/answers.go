package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/lib/pq"

	"github.com/spondic/api/internal/models"
)

// ListAnswers handles GET /api/rfp/:id/answers
func (h *Handler) ListAnswers(c echo.Context) error {
	orgID := getOrgID(c)
	projectID := c.Param("id")

	// Get all answers for this project's questions, with citations
	rows, err := h.DB.Query(
		`SELECT a.id, a.question_id, a.organization_id, a.draft_text, a.edited_text, a.final_text,
		        a.confidence_score, a.status, a.approved_by, a.approved_at, a.created_at, a.updated_at
		 FROM rfp_answers a
		 JOIN rfp_questions q ON q.id = a.question_id
		 WHERE q.project_id = $1 AND a.organization_id = $2
		 ORDER BY q.sort_order, q.created_at`,
		projectID, orgID,
	)
	if err != nil {
		log.Printf("error listing answers: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	answers := make([]models.RFPAnswer, 0)
	answerIDs := make([]string, 0)

	for rows.Next() {
		var a models.RFPAnswer
		if err := rows.Scan(
			&a.ID, &a.QuestionID, &a.OrganizationID, &a.DraftText, &a.EditedText, &a.FinalText,
			&a.ConfidenceScore, &a.Status, &a.ApprovedBy, &a.ApprovedAt,
			&a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			log.Printf("error scanning answer: %v", err)
			continue
		}
		a.Citations = make([]models.RFPAnswerCitation, 0)
		a.Comments = make([]models.RFPAnswerComment, 0)
		answers = append(answers, a)
		answerIDs = append(answerIDs, a.ID)
	}

	// Fetch citations for all answers
	if len(answerIDs) > 0 {
		citRows, err := h.DB.Query(
			`SELECT id, answer_id, document_id, chunk_id, citation_text, relevance_score, created_at
			 FROM rfp_answer_citations
			 WHERE answer_id = ANY($1)`,
			pq.Array(answerIDs),
		)
		if err != nil {
			log.Printf("error fetching citations: %v", err)
		} else {
			defer citRows.Close()
			citationMap := make(map[string][]models.RFPAnswerCitation)
			for citRows.Next() {
				var cit models.RFPAnswerCitation
				if err := citRows.Scan(
					&cit.ID, &cit.AnswerID, &cit.DocumentID, &cit.ChunkID,
					&cit.CitationText, &cit.RelevanceScore, &cit.CreatedAt,
				); err != nil {
					log.Printf("error scanning citation: %v", err)
					continue
				}
				citationMap[cit.AnswerID] = append(citationMap[cit.AnswerID], cit)
			}
			for i := range answers {
				if cits, ok := citationMap[answers[i].ID]; ok {
					answers[i].Citations = cits
				}
			}
		}

		// Fetch comments for all answers
		comRows, err := h.DB.Query(
			`SELECT id, answer_id, organization_id, user_id, comment_text, created_at, updated_at
			 FROM rfp_answer_comments
			 WHERE answer_id = ANY($1)
			 ORDER BY created_at`,
			pq.Array(answerIDs),
		)
		if err != nil {
			log.Printf("error fetching comments: %v", err)
		} else {
			defer comRows.Close()
			commentMap := make(map[string][]models.RFPAnswerComment)
			for comRows.Next() {
				var com models.RFPAnswerComment
				if err := comRows.Scan(
					&com.ID, &com.AnswerID, &com.OrganizationID, &com.UserID,
					&com.CommentText, &com.CreatedAt, &com.UpdatedAt,
				); err != nil {
					log.Printf("error scanning comment: %v", err)
					continue
				}
				commentMap[com.AnswerID] = append(commentMap[com.AnswerID], com)
			}
			for i := range answers {
				if coms, ok := commentMap[answers[i].ID]; ok {
					answers[i].Comments = coms
				}
			}
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"answers": answers,
	})
}

// UpdateAnswer handles PUT /api/rfp/:id/answers/:aid
func (h *Handler) UpdateAnswer(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	answerID := c.Param("aid")

	var body struct {
		EditedText *string `json:"edited_text"`
		FinalText  *string `json:"final_text"`
		Status     *string `json:"status"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	// Get existing answer for history
	var prevEditedText, prevDraftText *string
	err := h.DB.QueryRow(
		`SELECT edited_text, draft_text FROM rfp_answers WHERE id = $1 AND organization_id = $2`,
		answerID, orgID,
	).Scan(&prevEditedText, &prevDraftText)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "answer not found"})
	}
	if err != nil {
		log.Printf("error fetching answer: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if body.EditedText != nil {
		setClauses = append(setClauses, "edited_text = $"+itoa(argIdx))
		args = append(args, *body.EditedText)
		argIdx++

		// Record history
		prevText := prevEditedText
		if prevText == nil {
			prevText = prevDraftText
		}
		_, _ = h.DB.Exec(
			`INSERT INTO rfp_answer_history (answer_id, action, previous_text, new_text, edited_by)
			 VALUES ($1, 'edited', $2, $3, $4)`,
			answerID, prevText, *body.EditedText, userID,
		)
	}
	if body.FinalText != nil {
		setClauses = append(setClauses, "final_text = $"+itoa(argIdx))
		args = append(args, *body.FinalText)
		argIdx++
	}
	if body.Status != nil {
		valid := map[string]bool{"draft": true, "in_review": true, "approved": true, "rejected": true}
		if !valid[*body.Status] {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid status"})
		}
		setClauses = append(setClauses, "status = $"+itoa(argIdx))
		args = append(args, *body.Status)
		argIdx++

		// Log status change activity
		_, _ = h.DB.Exec(
			`INSERT INTO rfp_answer_history (answer_id, action, edited_by)
			 VALUES ($1, $2, $3)`,
			answerID, *body.Status, userID,
		)
	}

	if len(setClauses) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "no fields to update"})
	}

	setClauses = append(setClauses, "updated_at = NOW()")

	query := "UPDATE rfp_answers SET "
	for i, clause := range setClauses {
		if i > 0 {
			query += ", "
		}
		query += clause
	}
	query += " WHERE id = $" + itoa(argIdx) + " AND organization_id = $" + itoa(argIdx+1)
	query += " RETURNING id, question_id, organization_id, draft_text, edited_text, final_text, confidence_score, status, approved_by, approved_at, created_at, updated_at"
	args = append(args, answerID, orgID)

	var a models.RFPAnswer
	err = h.DB.QueryRow(query, args...).Scan(
		&a.ID, &a.QuestionID, &a.OrganizationID, &a.DraftText, &a.EditedText, &a.FinalText,
		&a.ConfidenceScore, &a.Status, &a.ApprovedBy, &a.ApprovedAt,
		&a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		log.Printf("error updating answer: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.JSON(http.StatusOK, a)
}

// ApproveAnswer handles POST /api/rfp/:id/answers/:aid/approve
func (h *Handler) ApproveAnswer(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	answerID := c.Param("aid")

	now := time.Now()
	var a models.RFPAnswer
	err := h.DB.QueryRow(
		`UPDATE rfp_answers
		 SET status = 'approved', approved_by = $1, approved_at = $2, updated_at = NOW()
		 WHERE id = $3 AND organization_id = $4
		 RETURNING id, question_id, organization_id, draft_text, edited_text, final_text,
		           confidence_score, status, approved_by, approved_at, created_at, updated_at`,
		userID, now, answerID, orgID,
	).Scan(
		&a.ID, &a.QuestionID, &a.OrganizationID, &a.DraftText, &a.EditedText, &a.FinalText,
		&a.ConfidenceScore, &a.Status, &a.ApprovedBy, &a.ApprovedAt,
		&a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "answer not found"})
	}
	if err != nil {
		log.Printf("error approving answer: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Log approval activity
	_, _ = h.DB.Exec(
		`INSERT INTO rfp_answer_history (answer_id, action, edited_by)
		 VALUES ($1, 'approved', $2)`,
		answerID, userID,
	)

	// Also update the question status to approved
	h.DB.Exec(
		`UPDATE rfp_questions SET status = 'approved', updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
		a.QuestionID, orgID,
	)

	// Send webhook notifications
	if h.Webhooks != nil {
		projectID := c.Param("id")
		var projectName string
		var qNumber *int
		_ = h.DB.QueryRow(`SELECT name FROM projects WHERE id = $1 AND organization_id = $2`, projectID, orgID).Scan(&projectName)
		_ = h.DB.QueryRow(`SELECT question_number FROM rfp_questions WHERE id = $1 AND organization_id = $2`, a.QuestionID, orgID).Scan(&qNumber)
		if projectName == "" {
			projectName = projectID
		}
		qLabel := "Answer"
		if qNumber != nil {
			qLabel = fmt.Sprintf("Q%d", *qNumber)
		}
		title := fmt.Sprintf("Answer Approved: %s in %s", qLabel, projectName)
		msg := fmt.Sprintf("*%s* in *%s* has been approved.", qLabel, projectName)
		h.Webhooks.NotifyWebhooks(orgID, "answer_approved", title, msg)
	}

	// Notify the project creator (not the approver)
	if h.Notifier != nil {
		projectID := c.Param("id")
		var createdBy string
		_ = h.DB.QueryRow(`SELECT created_by FROM projects WHERE id = $1 AND organization_id = $2`, projectID, orgID).Scan(&createdBy)
		if createdBy != "" && createdBy != userID {
			_ = h.Notifier.Create(orgID, createdBy, "answer_approved", "Answer Approved", "An answer has been approved in your project.", "project", projectID)
			if h.Events != nil {
				h.Events.PublishToUser(h.DB, orgID, createdBy, "notification.new", map[string]string{"type": "answer_approved"})
			}
		}
	}

	return c.JSON(http.StatusOK, a)
}

// CommentOnAnswer handles POST /api/rfp/:id/answers/:aid/comment
func (h *Handler) CommentOnAnswer(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	answerID := c.Param("aid")

	var body struct {
		CommentText string `json:"comment_text"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if body.CommentText == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "comment_text is required"})
	}

	// Verify the answer exists and belongs to the org
	var exists bool
	err := h.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM rfp_answers WHERE id = $1 AND organization_id = $2)`,
		answerID, orgID,
	).Scan(&exists)
	if err != nil || !exists {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "answer not found"})
	}

	var comment models.RFPAnswerComment
	err = h.DB.QueryRow(
		`INSERT INTO rfp_answer_comments (answer_id, organization_id, user_id, comment_text)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, answer_id, organization_id, user_id, comment_text, created_at, updated_at`,
		answerID, orgID, userID, body.CommentText,
	).Scan(
		&comment.ID, &comment.AnswerID, &comment.OrganizationID, &comment.UserID,
		&comment.CommentText, &comment.CreatedAt, &comment.UpdatedAt,
	)
	if err != nil {
		log.Printf("error inserting comment: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Log comment activity
	_, _ = h.DB.Exec(
		`INSERT INTO rfp_answer_history (answer_id, action, new_text, edited_by)
		 VALUES ($1, 'commented', $2, $3)`,
		answerID, body.CommentText, userID,
	)

	// Notify other commenters on this answer
	if h.Notifier != nil {
		commenterRows, err := h.DB.Query(
			`SELECT DISTINCT user_id FROM rfp_answer_comments WHERE answer_id = $1 AND organization_id = $2 AND user_id != $3`,
			answerID, orgID, userID,
		)
		if err == nil {
			defer commenterRows.Close()
			for commenterRows.Next() {
				var targetUserID string
				if commenterRows.Scan(&targetUserID) == nil {
					_ = h.Notifier.Create(orgID, targetUserID, "comment_added", "New Comment", "A new comment was added on an answer you commented on.", "answer", answerID)
					if h.Events != nil {
						h.Events.PublishToUser(h.DB, orgID, targetUserID, "notification.new", map[string]string{"type": "comment_added"})
					}
				}
			}
		}
	}

	return c.JSON(http.StatusCreated, comment)
}

// ListAnswerHistory handles GET /api/rfp/:id/answers/:aid/history
func (h *Handler) ListAnswerHistory(c echo.Context) error {
	orgID := getOrgID(c)
	answerID := c.Param("aid")

	// Verify answer belongs to org
	var exists bool
	err := h.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM rfp_answers WHERE id = $1 AND organization_id = $2)`,
		answerID, orgID,
	).Scan(&exists)
	if err != nil || !exists {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "answer not found"})
	}

	rows, err := h.DB.Query(
		`SELECT id, answer_id, action, previous_text, new_text, edited_by, edited_at
		 FROM rfp_answer_history
		 WHERE answer_id = $1
		 ORDER BY edited_at DESC`,
		answerID,
	)
	if err != nil {
		log.Printf("error listing answer history: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	history := make([]models.RFPAnswerHistory, 0)
	for rows.Next() {
		var h models.RFPAnswerHistory
		if err := rows.Scan(
			&h.ID, &h.AnswerID, &h.Action, &h.PreviousText, &h.NewText, &h.EditedBy, &h.EditedAt,
		); err != nil {
			log.Printf("error scanning history: %v", err)
			continue
		}
		history = append(history, h)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"history": history,
	})
}

