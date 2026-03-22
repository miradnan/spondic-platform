package handlers

import (
	"database/sql"
	"log"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/spondic/api/internal/models"
)

// ListQuestions handles GET /api/rfp/:id/questions
func (h *Handler) ListQuestions(c echo.Context) error {
	orgID := getOrgID(c)
	projectID := c.Param("id")

	page, limit, offset := paginationParams(c)
	assignedToFilter := c.QueryParam("assigned_to")

	// Build count query with optional assigned_to filter
	countQuery := `SELECT COUNT(*) FROM rfp_questions WHERE project_id = $1 AND organization_id = $2`
	countArgs := []interface{}{projectID, orgID}
	if assignedToFilter != "" {
		countQuery += ` AND assigned_to = $3`
		countArgs = append(countArgs, assignedToFilter)
	}

	var total int64
	err := h.DB.QueryRow(countQuery, countArgs...).Scan(&total)
	if err != nil {
		log.Printf("error counting questions: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Build list query with optional assigned_to filter
	listQuery := `SELECT q.id, q.project_id, q.organization_id, q.question_text, q.section,
		        q.question_number, q.is_mandatory, q.word_limit, q.assigned_to, q.status, q.sort_order,
		        q.created_at, q.updated_at,
		        a.id, a.draft_text, a.edited_text, a.final_text, a.confidence_score, a.status,
		        a.approved_by, a.approved_at
		 FROM rfp_questions q
		 LEFT JOIN rfp_answers a ON a.question_id = q.id AND a.organization_id = q.organization_id
		 WHERE q.project_id = $1 AND q.organization_id = $2`
	listArgs := []interface{}{projectID, orgID}
	argIdx := 3

	if assignedToFilter != "" {
		listQuery += ` AND q.assigned_to = $` + itoa(argIdx)
		listArgs = append(listArgs, assignedToFilter)
		argIdx++
	}

	listQuery += ` ORDER BY q.sort_order, q.created_at LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	listArgs = append(listArgs, limit, offset)

	rows, err := h.DB.Query(listQuery, listArgs...)
	if err != nil {
		log.Printf("error listing questions: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	questions := make([]models.RFPQuestion, 0)
	for rows.Next() {
		var q models.RFPQuestion
		var aID, aDraft, aEdited, aFinal, aStatus, aApprovedBy *string
		var aConfidence *float64
		nullTime := &sql.NullTime{}

		if err := rows.Scan(
			&q.ID, &q.ProjectID, &q.OrganizationID, &q.QuestionText, &q.Section,
			&q.QuestionNumber, &q.IsMandatory, &q.WordLimit, &q.AssignedTo, &q.Status, &q.SortOrder,
			&q.CreatedAt, &q.UpdatedAt,
			&aID, &aDraft, &aEdited, &aFinal, &aConfidence, &aStatus,
			&aApprovedBy, nullTime,
		); err != nil {
			log.Printf("error scanning question: %v", err)
			continue
		}

		if aID != nil {
			answer := &models.RFPAnswer{
				ID:             *aID,
				QuestionID:     q.ID,
				OrganizationID: q.OrganizationID,
				DraftText:      aDraft,
				EditedText:     aEdited,
				FinalText:      aFinal,
				ConfidenceScore: aConfidence,
				Status:         deref(aStatus, "draft"),
				ApprovedBy:     aApprovedBy,
			}
			if nullTime.Valid {
				answer.ApprovedAt = &nullTime.Time
			}
			q.Answer = answer
		}
		questions = append(questions, q)
	}

	return c.JSON(http.StatusOK, models.PaginatedResponse{
		Data: questions,
		Pagination: models.Pagination{
			Page:       page,
			Limit:      limit,
			Total:      total,
			TotalPages: totalPages(total, limit),
		},
	})
}

// UpdateQuestion handles PUT /api/rfp/:id/questions/:qid
func (h *Handler) UpdateQuestion(c echo.Context) error {
	orgID := getOrgID(c)
	projectID := c.Param("id")
	questionID := c.Param("qid")

	var body struct {
		QuestionText *string `json:"question_text"`
		Section      *string `json:"section"`
		IsMandatory  *bool   `json:"is_mandatory"`
		WordLimit    *int    `json:"word_limit"`
		Status       *string `json:"status"`
		SortOrder    *int    `json:"sort_order"`
		AssignedTo   *string `json:"assigned_to"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if body.QuestionText != nil {
		setClauses = append(setClauses, "question_text = $"+itoa(argIdx))
		args = append(args, *body.QuestionText)
		argIdx++
	}
	if body.Section != nil {
		setClauses = append(setClauses, "section = $"+itoa(argIdx))
		args = append(args, *body.Section)
		argIdx++
	}
	if body.IsMandatory != nil {
		setClauses = append(setClauses, "is_mandatory = $"+itoa(argIdx))
		args = append(args, *body.IsMandatory)
		argIdx++
	}
	if body.WordLimit != nil {
		setClauses = append(setClauses, "word_limit = $"+itoa(argIdx))
		args = append(args, *body.WordLimit)
		argIdx++
	}
	if body.Status != nil {
		valid := map[string]bool{"draft": true, "in_review": true, "approved": true}
		if !valid[*body.Status] {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid status"})
		}
		setClauses = append(setClauses, "status = $"+itoa(argIdx))
		args = append(args, *body.Status)
		argIdx++
	}
	if body.SortOrder != nil {
		setClauses = append(setClauses, "sort_order = $"+itoa(argIdx))
		args = append(args, *body.SortOrder)
		argIdx++
	}
	if body.AssignedTo != nil {
		if *body.AssignedTo == "" {
			setClauses = append(setClauses, "assigned_to = NULL")
		} else {
			setClauses = append(setClauses, "assigned_to = $"+itoa(argIdx))
			args = append(args, *body.AssignedTo)
			argIdx++
		}
	}

	if len(setClauses) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "no fields to update"})
	}

	setClauses = append(setClauses, "updated_at = NOW()")

	query := "UPDATE rfp_questions SET "
	for i, clause := range setClauses {
		if i > 0 {
			query += ", "
		}
		query += clause
	}
	query += " WHERE id = $" + itoa(argIdx) + " AND project_id = $" + itoa(argIdx+1) + " AND organization_id = $" + itoa(argIdx+2)
	query += " RETURNING id, project_id, organization_id, question_text, section, question_number, is_mandatory, word_limit, assigned_to, status, sort_order, created_at, updated_at"
	args = append(args, questionID, projectID, orgID)

	var q models.RFPQuestion
	err := h.DB.QueryRow(query, args...).Scan(
		&q.ID, &q.ProjectID, &q.OrganizationID, &q.QuestionText, &q.Section,
		&q.QuestionNumber, &q.IsMandatory, &q.WordLimit, &q.AssignedTo, &q.Status, &q.SortOrder,
		&q.CreatedAt, &q.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "question not found"})
	}
	if err != nil {
		log.Printf("error updating question: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.JSON(http.StatusOK, q)
}

func deref(s *string, def string) string {
	if s == nil {
		return def
	}
	return *s
}
