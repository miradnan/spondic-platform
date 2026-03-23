package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"github.com/spondic/api/internal/middleware"
	"github.com/spondic/api/internal/services"
)

// UploadRFP handles POST /api/rfp
// Uploads RFP document(s) to a project, saves to S3, creates document records, and links them.
func (h *Handler) UploadRFP(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	form, err := c.MultipartForm()
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid multipart form"})
	}

	projectID := strings.TrimSpace(c.FormValue("project_id"))
	if projectID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "project_id is required"})
	}

	// Verify project belongs to org
	var exists bool
	err = h.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL)`,
		projectID, orgID,
	).Scan(&exists)
	if err != nil || !exists {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "project not found"})
	}

	uploadedFiles := form.File["files"]
	pasteText := strings.TrimSpace(c.FormValue("paste"))

	if len(uploadedFiles) == 0 && pasteText == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "provide files or pasted text"})
	}

	if h.S3 == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "S3 not configured"})
	}

	ctx := c.Request().Context()
	type uploadedDoc struct {
		ID       string `json:"id"`
		FileName string `json:"file_name"`
		Size     int64  `json:"file_size_bytes"`
		S3Key    string `json:"s3_key"`
	}
	var docs []uploadedDoc

	for _, fh := range uploadedFiles {
		docID := uuid.New().String()
		ext := strings.ToLower(filepath.Ext(fh.Filename))
		if ext == "" {
			ext = ".bin"
		}
		s3Key := orgID + "/documents/" + docID + ext

		file, err := fh.Open()
		if err != nil {
			log.Printf("error opening uploaded file: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to process uploaded file"})
		}

		if err := h.S3.Upload(ctx, s3Key, file, fh.Header.Get("Content-Type")); err != nil {
			file.Close()
			log.Printf("error uploading to S3: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to upload file"})
		}
		file.Close()

		// Insert document record
		_, err = h.DB.Exec(
			`INSERT INTO documents (id, organization_id, uploaded_by_user_id, title, file_name, file_size_bytes, source_type, status)
			 VALUES ($1, $2, $3, $4, $5, $6, 'rfp', 'processing')`,
			docID, orgID, userID, fh.Filename, fh.Filename, fh.Size,
		)
		if err != nil {
			log.Printf("error inserting RFP document: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		}

		// Link document to project
		_, err = h.DB.Exec(
			`INSERT INTO project_documents (project_id, document_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			projectID, docID,
		)
		if err != nil {
			log.Printf("error linking document to project: %v", err)
		}

		docs = append(docs, uploadedDoc{
			ID:       docID,
			FileName: fh.Filename,
			Size:     fh.Size,
			S3Key:    s3Key,
		})
	}

	// Auto-parse: update project status and trigger parsing in background
	h.DB.Exec(`UPDATE projects SET status = 'parsing', updated_at = NOW() WHERE id = $1 AND organization_id = $2`, projectID, orgID)

	maxQuestions := 0
	if limits := middleware.GetPlanLimits(c); limits != nil && limits.MaxQuestions != nil {
		maxQuestions = *limits.MaxQuestions
	}

	go func(oID, uID, pID string, maxQ int) {
		total, err := h.parseProjectRFP(context.Background(), oID, pID, maxQ)
		if err != nil {
			log.Printf("auto-parse error for project %s: %v", pID, err)
			h.DB.Exec(`UPDATE projects SET status = 'draft', updated_at = NOW() WHERE id = $1 AND organization_id = $2`, pID, oID)
			if h.Events != nil {
				h.Events.PublishToUser(h.DB, oID, uID, "project.parsed", map[string]interface{}{
					"project_id":     pID,
					"status":         "failed",
					"error":          err.Error(),
				})
			}
			return
		}
		h.DB.Exec(`UPDATE projects SET status = 'parsed', updated_at = NOW() WHERE id = $1 AND organization_id = $2`, pID, oID)
		if h.Events != nil {
			h.Events.PublishToUser(h.DB, oID, uID, "project.parsed", map[string]interface{}{
				"project_id":      pID,
				"status":          "parsed",
				"questions_found": total,
			})
		}
	}(orgID, userID, projectID, maxQuestions)

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"project_id": projectID,
		"documents":  docs,
	})
}

// parseProjectRFP is the shared parse logic used by both UploadRFP (auto) and ParseRFP (manual).
// maxQuestions is the plan limit for questions per RFP (0 = unlimited).
func (h *Handler) parseProjectRFP(ctx context.Context, orgID, projectID string, maxQuestions int) (int, error) {
	rows, err := h.DB.Query(
		`SELECT d.id, d.file_name
		 FROM documents d
		 JOIN project_documents pd ON pd.document_id = d.id
		 WHERE pd.project_id = $1 AND d.organization_id = $2 AND d.deleted_at IS NULL`,
		projectID, orgID,
	)
	if err != nil {
		return 0, fmt.Errorf("query project documents: %w", err)
	}
	defer rows.Close()

	type docInfo struct {
		ID       string
		FileName string
	}
	var projectDocs []docInfo
	for rows.Next() {
		var d docInfo
		if err := rows.Scan(&d.ID, &d.FileName); err != nil {
			log.Printf("error scanning document: %v", err)
			continue
		}
		projectDocs = append(projectDocs, d)
	}

	if len(projectDocs) == 0 {
		return 0, fmt.Errorf("no documents found for this project")
	}

	totalQuestions := 0
	for _, doc := range projectDocs {
		ext := strings.ToLower(filepath.Ext(doc.FileName))
		if ext == "" {
			ext = ".bin"
		}
		s3Key := orgID + "/documents/" + doc.ID + ext

		resp, err := h.AI.ParseRFP(ctx, orgID, doc.ID, s3Key)
		if err != nil {
			log.Printf("AI parse error for document %s: %v", doc.ID, err)
			continue
		}
		if resp.Error != "" {
			log.Printf("AI parse returned error for document %s: %s", doc.ID, resp.Error)
			continue
		}

		for i, q := range resp.Questions {
			// Enforce questions-per-RFP plan limit
			if maxQuestions > 0 && totalQuestions >= maxQuestions {
				log.Printf("question limit reached (%d) for project %s, skipping remaining", maxQuestions, projectID)
				break
			}
			_, err := h.DB.Exec(
				`INSERT INTO rfp_questions (project_id, organization_id, question_text, section, question_number, is_mandatory, word_limit, status, sort_order)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8)`,
				projectID, orgID, q.QuestionText, nullStr(q.Section), nullInt(q.Number),
				q.IsMandatory, q.WordLimit, i+1,
			)
			if err != nil {
				log.Printf("error inserting question: %v", err)
				continue
			}
			totalQuestions++
		}
	}

	// Send webhook and in-app notifications
	if totalQuestions > 0 {
		var projectName, createdBy string
		_ = h.DB.QueryRow(`SELECT name, created_by FROM projects WHERE id = $1 AND organization_id = $2`, projectID, orgID).Scan(&projectName, &createdBy)
		if projectName == "" {
			projectName = projectID
		}
		title := "RFP Parsed: " + projectName
		msg := fmt.Sprintf("*%s* has been parsed — *%d* questions extracted.", projectName, totalQuestions)

		if h.Webhooks != nil {
			h.Webhooks.NotifyWebhooks(orgID, "rfp_parsed", title, msg)
		}

		if h.Notifier != nil && createdBy != "" {
			nBody := fmt.Sprintf("%s has been parsed — %d questions extracted.", projectName, totalQuestions)
			_ = h.Notifier.Create(orgID, createdBy, "rfp_parsed", title, nBody, "project", projectID)
			if h.Events != nil {
				h.Events.PublishToUser(h.DB, orgID, createdBy, "notification.new", map[string]string{"type": "rfp_parsed"})
			}
		}
	}

	return totalQuestions, nil
}

// ParseRFP handles POST /api/rfp/:id/parse
// Calls the AI service to extract questions from the RFP documents in the project.
func (h *Handler) ParseRFP(c echo.Context) error {
	orgID := getOrgID(c)
	projectID := c.Param("id")

	maxQ := 0
	if limits := middleware.GetPlanLimits(c); limits != nil && limits.MaxQuestions != nil {
		maxQ = *limits.MaxQuestions
	}

	totalQuestions, err := h.parseProjectRFP(c.Request().Context(), orgID, projectID, maxQ)
	if err != nil {
		log.Printf("parse error for project %s: %v", projectID, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"status":          "parsed",
		"questions_found": totalQuestions,
	})
}

// DraftRFP handles POST /api/rfp/:id/draft
// Calls the AI service to generate draft answers for all questions in the project.
func (h *Handler) DraftRFP(c echo.Context) error {
	orgID := getOrgID(c)
	projectID := c.Param("id")

	// Check token limit before making AI calls
	if err := h.checkTokenLimit(orgID); err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}

	// Get all questions for this project
	rows, err := h.DB.Query(
		`SELECT id, question_text, section, word_limit
		 FROM rfp_questions
		 WHERE project_id = $1 AND organization_id = $2
		 ORDER BY sort_order`,
		projectID, orgID,
	)
	if err != nil {
		log.Printf("error querying questions: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	var questions []services.DraftQuestion
	for rows.Next() {
		var q services.DraftQuestion
		var section *string
		if err := rows.Scan(&q.QuestionID, &q.QuestionText, &section, &q.WordLimit); err != nil {
			log.Printf("error scanning question: %v", err)
			continue
		}
		if section != nil {
			q.Section = *section
		}
		questions = append(questions, q)
	}

	if len(questions) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "no questions found for this project"})
	}

	// Call AI draft service
	resp, err := h.AI.DraftAnswers(c.Request().Context(), orgID, projectID, questions)
	if err != nil {
		log.Printf("AI draft error: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "draft generation failed"})
	}
	if resp.Error != "" {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": resp.Error})
	}

	// Record token usage
	if resp.TokensUsed != nil {
		h.recordTokenUsage(orgID, resp.TokensUsed.TotalTokens)
	}

	// Save answers and citations
	answersCreated := 0
	for _, a := range resp.Answers {
		var answerID string
		err := h.DB.QueryRow(
			`INSERT INTO rfp_answers (question_id, organization_id, draft_text, confidence_score, status)
			 VALUES ($1, $2, $3, $4, 'draft')
			 ON CONFLICT (question_id) DO UPDATE SET draft_text = EXCLUDED.draft_text, confidence_score = EXCLUDED.confidence_score, updated_at = NOW()
			 RETURNING id`,
			a.QuestionID, orgID, a.DraftText, a.ConfidenceScore,
		).Scan(&answerID)
		if err != nil {
			// If ON CONFLICT doesn't work (no unique constraint on question_id), try upsert differently
			// First check if an answer already exists
			err2 := h.DB.QueryRow(
				`SELECT id FROM rfp_answers WHERE question_id = $1 AND organization_id = $2`, a.QuestionID, orgID,
			).Scan(&answerID)
			if err2 == sql.ErrNoRows {
				// Fresh insert without ON CONFLICT
				err3 := h.DB.QueryRow(
					`INSERT INTO rfp_answers (question_id, organization_id, draft_text, confidence_score, status)
					 VALUES ($1, $2, $3, $4, 'draft') RETURNING id`,
					a.QuestionID, orgID, a.DraftText, a.ConfidenceScore,
				).Scan(&answerID)
				if err3 != nil {
					log.Printf("error inserting answer: %v", err3)
					continue
				}
			} else if err2 == nil {
				// Update existing
				_, _ = h.DB.Exec(
					`UPDATE rfp_answers SET draft_text = $1, confidence_score = $2, status = 'draft', updated_at = NOW()
					 WHERE id = $3 AND organization_id = $4`,
					a.DraftText, a.ConfidenceScore, answerID, orgID,
				)
			} else {
				log.Printf("error upserting answer: %v / %v", err, err2)
				continue
			}
		}

		// Insert citations
		// Note: chunk_id from Weaviate is a Weaviate UUID, not a document_chunks PK,
		// so we store it as NULL to avoid FK constraint violations.
		for _, cit := range a.Citations {
			_, err := h.DB.Exec(
				`INSERT INTO rfp_answer_citations (answer_id, document_id, citation_text, document_title, relevance_score)
				 VALUES ($1, $2, $3, $4, $5)`,
				answerID, nullStr(cit.DocumentID), cit.CitationText, cit.DocumentTitle, cit.RelevanceScore,
			)
			if err != nil {
				log.Printf("error inserting citation: %v", err)
			}
		}

		// Log drafted activity
		h.DB.Exec(
			`INSERT INTO rfp_answer_history (answer_id, action, new_text, edited_by)
			 VALUES ($1, 'drafted', $2, 'ai')`,
			answerID, a.DraftText,
		)

		answersCreated++
	}

	// Update project status
	h.DB.Exec(
		`UPDATE projects SET status = 'in_progress', updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
		projectID, orgID,
	)

	// Send webhook and in-app notifications
	if answersCreated > 0 {
		var projectName, createdBy string
		_ = h.DB.QueryRow(`SELECT name, created_by FROM projects WHERE id = $1 AND organization_id = $2`, projectID, orgID).Scan(&projectName, &createdBy)
		if projectName == "" {
			projectName = projectID
		}
		title := "Answers Drafted: " + projectName
		msg := fmt.Sprintf("*%s* — *%d* answers have been generated.", projectName, answersCreated)

		if h.Webhooks != nil {
			h.Webhooks.NotifyWebhooks(orgID, "rfp_drafted", title, msg)
		}

		userID := getUserID(c)
		if h.Notifier != nil && createdBy != "" && createdBy != userID {
			nBody := fmt.Sprintf("%s — %d answers have been generated.", projectName, answersCreated)
			_ = h.Notifier.Create(orgID, createdBy, "rfp_drafted", title, nBody, "project", projectID)
			if h.Events != nil {
				h.Events.PublishToUser(h.DB, orgID, createdBy, "notification.new", map[string]string{"type": "rfp_drafted"})
			}
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"status":          "drafted",
		"answers_created": answersCreated,
	})
}

func nullInt(i int) *int {
	if i == 0 {
		return nil
	}
	return &i
}

// RedraftQuestion handles POST /api/rfp/:id/questions/:qid/redraft
func (h *Handler) RedraftQuestion(c echo.Context) error {
	orgID := getOrgID(c)
	projectID := c.Param("id")
	questionID := c.Param("qid")

	// Check token limit
	if err := h.checkTokenLimit(orgID); err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}

	// Get the question
	var q services.DraftQuestion
	var section *string
	err := h.DB.QueryRow(
		`SELECT id, question_text, section, word_limit
		 FROM rfp_questions
		 WHERE id = $1 AND project_id = $2 AND organization_id = $3`,
		questionID, projectID, orgID,
	).Scan(&q.QuestionID, &q.QuestionText, &section, &q.WordLimit)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "question not found"})
	}
	if err != nil {
		log.Printf("error fetching question: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	if section != nil {
		q.Section = *section
	}

	// Call AI to redraft
	resp, err := h.AI.DraftAnswers(c.Request().Context(), orgID, projectID, []services.DraftQuestion{q})
	if err != nil {
		log.Printf("AI redraft error: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "redraft failed"})
	}
	if resp.Error != "" || len(resp.Answers) == 0 {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "redraft returned no answers"})
	}

	// Record token usage
	if resp.TokensUsed != nil {
		h.recordTokenUsage(orgID, resp.TokensUsed.TotalTokens)
	}

	a := resp.Answers[0]

	// Delete old citations and update/insert answer
	var answerID string
	err = h.DB.QueryRow(
		`SELECT id FROM rfp_answers WHERE question_id = $1 AND organization_id = $2`,
		questionID, orgID,
	).Scan(&answerID)

	if err == sql.ErrNoRows {
		err = h.DB.QueryRow(
			`INSERT INTO rfp_answers (question_id, organization_id, draft_text, confidence_score, status)
			 VALUES ($1, $2, $3, $4, 'draft') RETURNING id`,
			questionID, orgID, a.DraftText, a.ConfidenceScore,
		).Scan(&answerID)
		if err != nil {
			log.Printf("error inserting redrafted answer: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		}
	} else if err == nil {
		// Save history
		var prevText *string
		h.DB.QueryRow(`SELECT draft_text FROM rfp_answers WHERE id = $1`, answerID).Scan(&prevText)
		if prevText != nil {
			h.DB.Exec(
				`INSERT INTO rfp_answer_history (answer_id, action, previous_text, new_text, edited_by)
				 VALUES ($1, 'redrafted', $2, $3, $4)`,
				answerID, *prevText, a.DraftText, getUserID(c),
			)
		}

		_, _ = h.DB.Exec(
			`UPDATE rfp_answers SET draft_text = $1, confidence_score = $2, status = 'draft', updated_at = NOW()
			 WHERE id = $3 AND organization_id = $4`,
			a.DraftText, a.ConfidenceScore, answerID, orgID,
		)
		// Remove old citations
		h.DB.Exec(`DELETE FROM rfp_answer_citations WHERE answer_id = $1`, answerID)
	} else {
		log.Printf("error checking existing answer: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Insert new citations
	for _, cit := range a.Citations {
		h.DB.Exec(
			`INSERT INTO rfp_answer_citations (answer_id, document_id, citation_text, document_title, relevance_score)
			 VALUES ($1, $2, $3, $4, $5)`,
			answerID, nullStr(cit.DocumentID), cit.CitationText, cit.DocumentTitle, cit.RelevanceScore,
		)
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "redrafted", "answer_id": answerID})
}
