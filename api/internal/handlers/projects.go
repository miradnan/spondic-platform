package handlers

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/spondic/api/internal/models"
)

// CreateProject handles POST /api/projects
func (h *Handler) CreateProject(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	var body struct {
		Name        string  `json:"name"`
		Description *string `json:"description"`
		Deadline    *string `json:"deadline"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if body.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "name is required"})
	}

	// Check monthly RFP creation limit
	if err := h.checkRFPLimit(c, orgID); err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}

	var deadline *time.Time
	if body.Deadline != nil && *body.Deadline != "" {
		t, err := time.Parse(time.RFC3339, *body.Deadline)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "deadline must be RFC3339 format"})
		}
		deadline = &t
	}

	var project models.Project
	err := h.DB.QueryRow(
		`INSERT INTO projects (organization_id, name, description, deadline, status, created_by)
		 VALUES ($1, $2, $3, $4, 'draft', $5)
		 RETURNING id, organization_id, name, description, deadline, status, created_by, created_at, updated_at`,
		orgID, body.Name, body.Description, deadline, userID,
	).Scan(
		&project.ID, &project.OrganizationID, &project.Name, &project.Description,
		&project.Deadline, &project.Status, &project.CreatedBy,
		&project.CreatedAt, &project.UpdatedAt,
	)
	if err != nil {
		log.Printf("error creating project: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Record usage metric for RFP/project creation
	h.recordUsageMetric(orgID, "rfps_processed", 1)

	return c.JSON(http.StatusCreated, project)
}

// ListProjects handles GET /api/projects
func (h *Handler) ListProjects(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	userID := getUserID(c)
	page, limit, offset := paginationParams(c)
	statusFilter := c.QueryParam("status")

	// Role-based visibility: admins see all, members see their team's projects + own + assigned
	isAdminUser := isAdmin(c)

	// Build the member visibility filter (used for both count and fetch)
	memberFilter := ""
	if !isAdminUser {
		memberFilter = ` AND (
			p.created_by = $__USER__
			OR p.team_id IN (SELECT team_id FROM team_members WHERE user_id = $__USER__)
			OR EXISTS (SELECT 1 FROM rfp_questions rq2 WHERE rq2.project_id = p.id AND rq2.assigned_to = $__USER__)
		)`
	}

	// Count total
	var total int64
	countQuery := `SELECT COUNT(*) FROM projects p WHERE p.organization_id = $1 AND p.deleted_at IS NULL`
	args := []interface{}{orgID}
	argIdx := 2

	if !isAdminUser {
		countQuery += strings.ReplaceAll(memberFilter, "$__USER__", "$"+itoa(argIdx))
		args = append(args, userID)
		argIdx++
	}

	if statusFilter != "" {
		countQuery += ` AND p.status = $` + itoa(argIdx)
		args = append(args, statusFilter)
		argIdx++
	}

	if err := h.DB.QueryRow(countQuery, args...).Scan(&total); err != nil {
		log.Printf("error counting projects: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Fetch projects with question/answer counts
	query := `
		SELECT p.id, p.organization_id, p.name, p.description, p.deadline, p.status,
		       p.created_by, p.created_at, p.updated_at,
		       COALESCE(q.total, 0) AS question_count,
		       COALESCE(q.draft_count, 0) AS draft_count,
		       COALESCE(q.in_review_count, 0) AS in_review_count,
		       COALESCE(q.approved_count, 0) AS approved_count,
		       COALESCE(q.rejected_count, 0) AS rejected_count,
		       COALESCE(pd.doc_count, 0) AS document_count
		FROM projects p
		LEFT JOIN LATERAL (
			SELECT COUNT(*) AS total,
			       COUNT(*) FILTER (WHERE COALESCE(ra.status, rq.status) = 'draft') AS draft_count,
			       COUNT(*) FILTER (WHERE COALESCE(ra.status, rq.status) = 'in_review') AS in_review_count,
			       COUNT(*) FILTER (WHERE COALESCE(ra.status, rq.status) = 'approved') AS approved_count,
			       COUNT(*) FILTER (WHERE COALESCE(ra.status, rq.status) = 'rejected') AS rejected_count
			FROM rfp_questions rq
			LEFT JOIN LATERAL (
			    SELECT ra2.status FROM rfp_answers ra2 WHERE ra2.question_id = rq.id ORDER BY ra2.updated_at DESC LIMIT 1
			) ra ON true
			WHERE rq.project_id = p.id
		) q ON true
		LEFT JOIN LATERAL (
			SELECT COUNT(*) AS doc_count FROM project_documents pd2 WHERE pd2.project_id = p.id
		) pd ON true
		WHERE p.organization_id = $1 AND p.deleted_at IS NULL`

	fetchArgs := []interface{}{orgID}
	fetchIdx := 2

	if !isAdminUser {
		query += strings.ReplaceAll(memberFilter, "$__USER__", "$"+itoa(fetchIdx))
		fetchArgs = append(fetchArgs, userID)
		fetchIdx++
	}

	if statusFilter != "" {
		query += ` AND p.status = $` + itoa(fetchIdx)
		fetchArgs = append(fetchArgs, statusFilter)
		fetchIdx++
	}

	query += ` ORDER BY p.created_at DESC LIMIT $` + itoa(fetchIdx) + ` OFFSET $` + itoa(fetchIdx+1)
	fetchArgs = append(fetchArgs, limit, offset)

	rows, err := h.DB.Query(query, fetchArgs...)
	if err != nil {
		log.Printf("error listing projects: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	projects := make([]models.Project, 0)
	for rows.Next() {
		var p models.Project
		if err := rows.Scan(
			&p.ID, &p.OrganizationID, &p.Name, &p.Description, &p.Deadline, &p.Status,
			&p.CreatedBy, &p.CreatedAt, &p.UpdatedAt,
			&p.QuestionCount, &p.DraftCount, &p.InReviewCount, &p.ApprovedCount, &p.RejectedCount, &p.DocumentCount,
		); err != nil {
			log.Printf("error scanning project: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		}
		projects = append(projects, p)
	}

	return c.JSON(http.StatusOK, models.PaginatedResponse{
		Data: projects,
		Pagination: models.Pagination{
			Page:       page,
			Limit:      limit,
			Total:      total,
			TotalPages: totalPages(total, limit),
		},
	})
}

// GetProject handles GET /api/projects/:id
func (h *Handler) GetProject(c echo.Context) error {
	orgID := getOrgID(c)
	projectID := c.Param("id")

	var p models.Project
	err := h.DB.QueryRow(
		`SELECT p.id, p.organization_id, p.name, p.description, p.deadline, p.status,
		        p.created_by, p.created_at, p.updated_at,
		        COALESCE(q.total, 0), COALESCE(q.draft_count, 0), COALESCE(q.in_review_count, 0),
		        COALESCE(q.approved_count, 0), COALESCE(q.rejected_count, 0),
		        COALESCE(pd.doc_count, 0)
		 FROM projects p
		 LEFT JOIN LATERAL (
		     SELECT COUNT(*) AS total,
		            COUNT(*) FILTER (WHERE COALESCE(ra.status, rq.status) = 'draft') AS draft_count,
		            COUNT(*) FILTER (WHERE COALESCE(ra.status, rq.status) = 'in_review') AS in_review_count,
		            COUNT(*) FILTER (WHERE COALESCE(ra.status, rq.status) = 'approved') AS approved_count,
		            COUNT(*) FILTER (WHERE COALESCE(ra.status, rq.status) = 'rejected') AS rejected_count
		     FROM rfp_questions rq
		     LEFT JOIN LATERAL (
		         SELECT ra2.status FROM rfp_answers ra2 WHERE ra2.question_id = rq.id ORDER BY ra2.updated_at DESC LIMIT 1
		     ) ra ON true
		     WHERE rq.project_id = p.id
		 ) q ON true
		 LEFT JOIN LATERAL (
		     SELECT COUNT(*) AS doc_count FROM project_documents pd2 WHERE pd2.project_id = p.id
		 ) pd ON true
		 WHERE p.id = $1 AND p.organization_id = $2 AND p.deleted_at IS NULL`,
		projectID, orgID,
	).Scan(
		&p.ID, &p.OrganizationID, &p.Name, &p.Description, &p.Deadline, &p.Status,
		&p.CreatedBy, &p.CreatedAt, &p.UpdatedAt,
		&p.QuestionCount, &p.DraftCount, &p.InReviewCount, &p.ApprovedCount, &p.RejectedCount, &p.DocumentCount,
	)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "project not found"})
	}
	if err != nil {
		log.Printf("error getting project: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.JSON(http.StatusOK, p)
}

// UpdateProject handles PUT /api/projects/:id
func (h *Handler) UpdateProject(c echo.Context) error {
	orgID := getOrgID(c)
	projectID := c.Param("id")

	var body struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		Deadline    *string `json:"deadline"`
		Status      *string `json:"status"`
		TeamID      *string `json:"team_id"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	// Build dynamic update
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if body.Name != nil {
		setClauses = append(setClauses, "name = $"+itoa(argIdx))
		args = append(args, *body.Name)
		argIdx++
	}
	if body.Description != nil {
		setClauses = append(setClauses, "description = $"+itoa(argIdx))
		args = append(args, *body.Description)
		argIdx++
	}
	if body.Deadline != nil {
		if *body.Deadline == "" {
			setClauses = append(setClauses, "deadline = NULL")
		} else {
			t, err := time.Parse(time.RFC3339, *body.Deadline)
			if err != nil {
				return c.JSON(http.StatusBadRequest, map[string]string{"error": "deadline must be RFC3339 format"})
			}
			setClauses = append(setClauses, "deadline = $"+itoa(argIdx))
			args = append(args, t)
			argIdx++
		}
	}
	if body.Status != nil {
		validStatuses := map[string]bool{"draft": true, "in_progress": true, "completed": true, "submitted": true}
		if !validStatuses[*body.Status] {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid status"})
		}
		setClauses = append(setClauses, "status = $"+itoa(argIdx))
		args = append(args, *body.Status)
		argIdx++
	}
	if body.TeamID != nil {
		if *body.TeamID == "" {
			setClauses = append(setClauses, "team_id = NULL")
		} else {
			setClauses = append(setClauses, "team_id = $"+itoa(argIdx))
			args = append(args, *body.TeamID)
			argIdx++
		}
	}

	if len(setClauses) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "no fields to update"})
	}

	setClauses = append(setClauses, "updated_at = NOW()")

	query := "UPDATE projects SET "
	for i, clause := range setClauses {
		if i > 0 {
			query += ", "
		}
		query += clause
	}
	query += " WHERE id = $" + itoa(argIdx) + " AND organization_id = $" + itoa(argIdx+1) + " AND deleted_at IS NULL"
	query += " RETURNING id, organization_id, name, description, deadline, status, team_id, created_by, created_at, updated_at"
	args = append(args, projectID, orgID)

	var p models.Project
	err := h.DB.QueryRow(query, args...).Scan(
		&p.ID, &p.OrganizationID, &p.Name, &p.Description, &p.Deadline, &p.Status,
		&p.TeamID, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "project not found"})
	}
	if err != nil {
		log.Printf("error updating project: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.JSON(http.StatusOK, p)
}

// DeleteProject handles DELETE /api/projects/:id (hard delete)
// Cascades via FK ON DELETE CASCADE: rfp_questions, rfp_answers, rfp_answer_citations,
// rfp_answer_comments, rfp_answer_history, project_documents, approval_stages.
func (h *Handler) DeleteProject(c echo.Context) error {
	orgID := getOrgID(c)
	projectID := c.Param("id")

	// Collect approved answer IDs for Weaviate cleanup before deleting
	var answerIDs []string
	if h.AI != nil {
		answerRows, err := h.DB.Query(
			`SELECT a.id FROM rfp_answers a
			 JOIN rfp_questions q ON q.id = a.question_id
			 WHERE q.project_id = $1 AND a.organization_id = $2 AND a.status = 'approved'`,
			projectID, orgID,
		)
		if err == nil {
			defer answerRows.Close()
			for answerRows.Next() {
				var aid string
				if answerRows.Scan(&aid) == nil {
					answerIDs = append(answerIDs, aid)
				}
			}
		}
	}

	// Hard delete — ON DELETE CASCADE handles all child tables
	result, err := h.DB.Exec(
		`DELETE FROM projects WHERE id = $1 AND organization_id = $2`,
		projectID, orgID,
	)
	if err != nil {
		log.Printf("error deleting project: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "project not found"})
	}

	// Remove approved answers from Weaviate asynchronously
	if h.AI != nil && len(answerIDs) > 0 {
		go func(oID string, ids []string) {
			for _, aid := range ids {
				ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
				_ = h.AI.RemoveAnswer(ctx, oID, aid)
				cancel()
			}
		}(orgID, answerIDs)
	}

	return c.NoContent(http.StatusNoContent)
}

func itoa(i int) string {
	return strconv.Itoa(i)
}
