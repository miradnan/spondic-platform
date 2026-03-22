package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/lib/pq"

	"github.com/spondic/api/internal/models"
)

// CreateApprovalStages handles POST /api/projects/:id/approval-stages
func (h *Handler) CreateApprovalStages(c echo.Context) error {
	orgID := getOrgID(c)
	projectID := c.Param("id")

	var body struct {
		Stages []struct {
			Name         string  `json:"name"`
			SortOrder    int     `json:"sort_order"`
			RequiredRole *string `json:"required_role,omitempty"`
		} `json:"stages"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	// Default stages if none provided
	if len(body.Stages) == 0 {
		body.Stages = []struct {
			Name         string  `json:"name"`
			SortOrder    int     `json:"sort_order"`
			RequiredRole *string `json:"required_role,omitempty"`
		}{
			{Name: "Technical Review", SortOrder: 0},
			{Name: "Legal Review", SortOrder: 1},
			{Name: "Final Approval", SortOrder: 2},
		}
	}

	// Verify the project exists and belongs to this org
	var exists bool
	err := h.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL)`,
		projectID, orgID,
	).Scan(&exists)
	if err != nil || !exists {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "project not found"})
	}

	// Delete existing stages for this project (cascade deletes answer_approvals too)
	_, err = h.DB.Exec(
		`DELETE FROM approval_stages WHERE project_id = $1 AND organization_id = $2`,
		projectID, orgID,
	)
	if err != nil {
		log.Printf("error deleting existing approval stages: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Insert new stages
	stages := make([]models.ApprovalStage, 0, len(body.Stages))
	for _, s := range body.Stages {
		var stage models.ApprovalStage
		err := h.DB.QueryRow(
			`INSERT INTO approval_stages (project_id, organization_id, name, sort_order, required_role)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id, project_id, organization_id, name, sort_order, required_role, created_at`,
			projectID, orgID, s.Name, s.SortOrder, s.RequiredRole,
		).Scan(
			&stage.ID, &stage.ProjectID, &stage.OrganizationID,
			&stage.Name, &stage.SortOrder, &stage.RequiredRole, &stage.CreatedAt,
		)
		if err != nil {
			log.Printf("error inserting approval stage: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		}
		stages = append(stages, stage)
	}

	// Audit log
	h.DB.Exec(
		`INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id)
		 VALUES ($1, $2, $3, $4, $5)`,
		orgID, getUserID(c), "approval_stages_created", "project", projectID,
	)

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"stages": stages,
	})
}

// ListApprovalStages handles GET /api/projects/:id/approval-stages
func (h *Handler) ListApprovalStages(c echo.Context) error {
	orgID := getOrgID(c)
	projectID := c.Param("id")

	rows, err := h.DB.Query(
		`SELECT id, project_id, organization_id, name, sort_order, required_role, created_at
		 FROM approval_stages
		 WHERE project_id = $1 AND organization_id = $2
		 ORDER BY sort_order`,
		projectID, orgID,
	)
	if err != nil {
		log.Printf("error listing approval stages: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	stages := make([]models.ApprovalStage, 0)
	for rows.Next() {
		var s models.ApprovalStage
		if err := rows.Scan(
			&s.ID, &s.ProjectID, &s.OrganizationID,
			&s.Name, &s.SortOrder, &s.RequiredRole, &s.CreatedAt,
		); err != nil {
			log.Printf("error scanning approval stage: %v", err)
			continue
		}
		stages = append(stages, s)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"stages": stages,
	})
}

// StageApprove handles POST /api/rfp/:id/answers/:aid/stage-approve
func (h *Handler) StageApprove(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	answerID := c.Param("aid")

	var body struct {
		StageID string `json:"stage_id"`
		Status  string `json:"status"`
		Comment string `json:"comment"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if body.StageID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "stage_id is required"})
	}

	validStatuses := map[string]bool{"approved": true, "rejected": true, "skipped": true}
	if !validStatuses[body.Status] {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "status must be approved, rejected, or skipped"})
	}

	// Verify answer exists and belongs to org
	var answerExists bool
	err := h.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM rfp_answers WHERE id = $1 AND organization_id = $2)`,
		answerID, orgID,
	).Scan(&answerExists)
	if err != nil || !answerExists {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "answer not found"})
	}

	// Verify stage exists and belongs to org
	var stageExists bool
	err = h.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM approval_stages WHERE id = $1 AND organization_id = $2)`,
		body.StageID, orgID,
	).Scan(&stageExists)
	if err != nil || !stageExists {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "stage not found"})
	}

	// Upsert the approval record
	now := time.Now()
	var commentPtr *string
	if body.Comment != "" {
		commentPtr = &body.Comment
	}

	var approval models.AnswerApproval
	err = h.DB.QueryRow(
		`INSERT INTO answer_approvals (answer_id, stage_id, organization_id, status, approved_by, comment, approved_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (answer_id, stage_id) DO UPDATE
		 SET status = EXCLUDED.status, approved_by = EXCLUDED.approved_by,
		     comment = EXCLUDED.comment, approved_at = EXCLUDED.approved_at
		 RETURNING id, answer_id, stage_id, organization_id, status, approved_by, comment, approved_at, created_at`,
		answerID, body.StageID, orgID, body.Status, userID, commentPtr, now,
	).Scan(
		&approval.ID, &approval.AnswerID, &approval.StageID,
		&approval.OrganizationID, &approval.Status, &approval.ApprovedBy,
		&approval.Comment, &approval.ApprovedAt, &approval.CreatedAt,
	)
	if err != nil {
		log.Printf("error upserting answer approval: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Get the stage name for the response
	h.DB.QueryRow(
		`SELECT name, sort_order FROM approval_stages WHERE id = $1 AND organization_id = $2`,
		body.StageID, orgID,
	).Scan(&approval.StageName, &approval.SortOrder)

	// Check if all stages for this answer's project are approved
	// If any stage is rejected, set answer to rejected
	// If all stages are approved, set answer to approved
	var projectID string
	h.DB.QueryRow(
		`SELECT s.project_id FROM approval_stages s WHERE s.id = $1`,
		body.StageID,
	).Scan(&projectID)

	if projectID != "" {
		var totalStages, approvedStages, rejectedStages int
		h.DB.QueryRow(
			`SELECT
				(SELECT COUNT(*) FROM approval_stages WHERE project_id = $1 AND organization_id = $2),
				(SELECT COUNT(*) FROM answer_approvals aa
				 JOIN approval_stages s ON s.id = aa.stage_id
				 WHERE aa.answer_id = $3 AND aa.organization_id = $2 AND aa.status = 'approved'
				   AND s.project_id = $1),
				(SELECT COUNT(*) FROM answer_approvals aa
				 JOIN approval_stages s ON s.id = aa.stage_id
				 WHERE aa.answer_id = $3 AND aa.organization_id = $2 AND aa.status = 'rejected'
				   AND s.project_id = $1)`,
			projectID, orgID, answerID,
		).Scan(&totalStages, &approvedStages, &rejectedStages)

		if rejectedStages > 0 {
			h.DB.Exec(
				`UPDATE rfp_answers SET status = 'rejected', updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
				answerID, orgID,
			)
		} else if approvedStages == totalStages && totalStages > 0 {
			h.DB.Exec(
				`UPDATE rfp_answers SET status = 'approved', approved_by = $1, approved_at = $2, updated_at = NOW()
				 WHERE id = $3 AND organization_id = $4`,
				userID, now, answerID, orgID,
			)
			// Also update question status
			h.DB.Exec(
				`UPDATE rfp_questions SET status = 'approved', updated_at = NOW()
				 WHERE id = (SELECT question_id FROM rfp_answers WHERE id = $1) AND organization_id = $2`,
				answerID, orgID,
			)
		} else {
			// In progress — set to in_review
			h.DB.Exec(
				`UPDATE rfp_answers SET status = 'in_review', updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
				answerID, orgID,
			)
		}
	}

	// Audit log
	h.DB.Exec(
		`INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id)
		 VALUES ($1, $2, $3, $4, $5)`,
		orgID, userID, "stage_approval_"+body.Status, "answer_approval", answerID,
	)

	return c.JSON(http.StatusOK, approval)
}

// ListAnswerApprovals handles GET /api/rfp/:id/answers/:aid/approvals
func (h *Handler) ListAnswerApprovals(c echo.Context) error {
	orgID := getOrgID(c)
	answerID := c.Param("aid")
	projectID := c.Param("id")

	// Get all stages for the project with their approval status for this answer
	rows, err := h.DB.Query(
		`SELECT s.id, s.name, s.sort_order,
		        COALESCE(aa.id, '') AS approval_id,
		        COALESCE(aa.status, 'pending') AS status,
		        aa.approved_by, aa.comment, aa.approved_at,
		        COALESCE(aa.created_at, s.created_at) AS created_at
		 FROM approval_stages s
		 LEFT JOIN answer_approvals aa ON aa.stage_id = s.id AND aa.answer_id = $1 AND aa.organization_id = $3
		 WHERE s.project_id = $2 AND s.organization_id = $3
		 ORDER BY s.sort_order`,
		answerID, projectID, orgID,
	)
	if err != nil {
		log.Printf("error listing answer approvals: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	approvals := make([]models.AnswerApproval, 0)
	for rows.Next() {
		var a models.AnswerApproval
		a.AnswerID = answerID
		a.OrganizationID = orgID
		if err := rows.Scan(
			&a.StageID, &a.StageName, &a.SortOrder,
			&a.ID, &a.Status,
			&a.ApprovedBy, &a.Comment, &a.ApprovedAt,
			&a.CreatedAt,
		); err != nil {
			log.Printf("error scanning answer approval: %v", err)
			continue
		}
		approvals = append(approvals, a)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"approvals": approvals,
	})
}

// ListAllAnswerApprovals handles GET /api/rfp/:id/approvals — bulk fetch approvals for all answers in a project
func (h *Handler) ListAllAnswerApprovals(c echo.Context) error {
	orgID := getOrgID(c)
	projectID := c.Param("id")

	// Get all answer IDs for this project
	answerRows, err := h.DB.Query(
		`SELECT a.id FROM rfp_answers a
		 JOIN rfp_questions q ON q.id = a.question_id
		 WHERE q.project_id = $1 AND a.organization_id = $2`,
		projectID, orgID,
	)
	if err != nil {
		log.Printf("error listing answer IDs: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer answerRows.Close()

	answerIDs := make([]string, 0)
	for answerRows.Next() {
		var id string
		if err := answerRows.Scan(&id); err != nil {
			continue
		}
		answerIDs = append(answerIDs, id)
	}

	if len(answerIDs) == 0 {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"approvals": map[string][]models.AnswerApproval{},
		})
	}

	// Get all approval records for these answers
	rows, err := h.DB.Query(
		`SELECT s.id AS stage_id, s.name, s.sort_order,
		        aa.answer_id,
		        COALESCE(aa.id, '') AS approval_id,
		        COALESCE(aa.status, 'pending') AS status,
		        aa.approved_by, aa.comment, aa.approved_at, aa.created_at
		 FROM approval_stages s
		 CROSS JOIN unnest($1::uuid[]) AS aid(answer_id)
		 LEFT JOIN answer_approvals aa ON aa.stage_id = s.id AND aa.answer_id = aid.answer_id AND aa.organization_id = $3
		 WHERE s.project_id = $2 AND s.organization_id = $3
		 ORDER BY aa.answer_id, s.sort_order`,
		pq.Array(answerIDs), projectID, orgID,
	)
	if err != nil {
		log.Printf("error listing all answer approvals: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	approvalsMap := make(map[string][]models.AnswerApproval)
	for rows.Next() {
		var a models.AnswerApproval
		var answerID string
		a.OrganizationID = orgID
		if err := rows.Scan(
			&a.StageID, &a.StageName, &a.SortOrder,
			&answerID,
			&a.ID, &a.Status,
			&a.ApprovedBy, &a.Comment, &a.ApprovedAt, &a.CreatedAt,
		); err != nil {
			log.Printf("error scanning bulk approval: %v", err)
			continue
		}
		a.AnswerID = answerID
		approvalsMap[answerID] = append(approvalsMap[answerID], a)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"approvals": approvalsMap,
	})
}
