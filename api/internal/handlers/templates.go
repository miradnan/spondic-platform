package handlers

// templates.go routes:
// api.POST("/templates", h.CreateTemplate)
// api.GET("/templates", h.ListTemplates)
// api.GET("/templates/:id", h.GetTemplate)
// api.PUT("/templates/:id", h.UpdateTemplate)
// api.DELETE("/templates/:id", h.DeleteTemplate)
// api.POST("/templates/suggest", h.SuggestTemplate)

import (
	"database/sql"
	"log"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/spondic/api/internal/middleware"
	"github.com/spondic/api/internal/models"
)

// checkTemplateAccess verifies the template_library feature is enabled for the current plan.
func checkTemplateAccess(c echo.Context) error {
	if limits := middleware.GetPlanLimits(c); limits != nil {
		return checkFeatureEnabled("Template Library", limits.Templates)
	}
	return nil
}

// CreateTemplate handles POST /api/templates
func (h *Handler) CreateTemplate(c echo.Context) error {
	if err := checkTemplateAccess(c); err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}
	userID := getUserID(c)

	var body struct {
		Name            string  `json:"name"`
		Category        *string `json:"category"`
		QuestionPattern *string `json:"question_pattern"`
		AnswerTemplate  string  `json:"answer_template"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if body.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "name is required"})
	}
	if body.AnswerTemplate == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "answer_template is required"})
	}

	var t models.AnswerTemplate
	err := h.DB.QueryRow(
		`INSERT INTO answer_templates (organization_id, name, category, question_pattern, answer_template, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, organization_id, name, category, question_pattern, answer_template, created_by, usage_count, created_at, updated_at`,
		orgID, body.Name, body.Category, body.QuestionPattern, body.AnswerTemplate, userID,
	).Scan(
		&t.ID, &t.OrganizationID, &t.Name, &t.Category, &t.QuestionPattern,
		&t.AnswerTemplate, &t.CreatedBy, &t.UsageCount, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		log.Printf("error creating template: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.JSON(http.StatusCreated, t)
}

// ListTemplates handles GET /api/templates
func (h *Handler) ListTemplates(c echo.Context) error {
	if err := checkTemplateAccess(c); err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	page, limit, offset := paginationParams(c)
	category := c.QueryParam("category")
	search := c.QueryParam("search")

	// Build count query
	countQuery := `SELECT COUNT(*) FROM answer_templates WHERE organization_id = $1 AND deleted_at IS NULL`
	countArgs := []interface{}{orgID}
	argIdx := 2

	if category != "" {
		countQuery += ` AND category = $` + itoa(argIdx)
		countArgs = append(countArgs, category)
		argIdx++
	}
	if search != "" {
		countQuery += ` AND (name ILIKE $` + itoa(argIdx) + ` OR question_pattern ILIKE $` + itoa(argIdx) + `)`
		countArgs = append(countArgs, "%"+search+"%")
		argIdx++
	}

	var total int64
	if err := h.DB.QueryRow(countQuery, countArgs...).Scan(&total); err != nil {
		log.Printf("error counting templates: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Build list query
	listQuery := `SELECT id, organization_id, name, category, question_pattern, answer_template, created_by, usage_count, created_at, updated_at
		 FROM answer_templates
		 WHERE organization_id = $1 AND deleted_at IS NULL`
	listArgs := []interface{}{orgID}
	listIdx := 2

	if category != "" {
		listQuery += ` AND category = $` + itoa(listIdx)
		listArgs = append(listArgs, category)
		listIdx++
	}
	if search != "" {
		listQuery += ` AND (name ILIKE $` + itoa(listIdx) + ` OR question_pattern ILIKE $` + itoa(listIdx) + `)`
		listArgs = append(listArgs, "%"+search+"%")
		listIdx++
	}

	listQuery += ` ORDER BY usage_count DESC, created_at DESC LIMIT $` + itoa(listIdx) + ` OFFSET $` + itoa(listIdx+1)
	listArgs = append(listArgs, limit, offset)

	rows, err := h.DB.Query(listQuery, listArgs...)
	if err != nil {
		log.Printf("error listing templates: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	templates := make([]models.AnswerTemplate, 0)
	for rows.Next() {
		var t models.AnswerTemplate
		if err := rows.Scan(
			&t.ID, &t.OrganizationID, &t.Name, &t.Category, &t.QuestionPattern,
			&t.AnswerTemplate, &t.CreatedBy, &t.UsageCount, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			log.Printf("error scanning template: %v", err)
			continue
		}
		templates = append(templates, t)
	}

	return c.JSON(http.StatusOK, models.PaginatedResponse{
		Data: templates,
		Pagination: models.Pagination{
			Page:       page,
			Limit:      limit,
			Total:      total,
			TotalPages: totalPages(total, limit),
		},
	})
}

// GetTemplate handles GET /api/templates/:id
func (h *Handler) GetTemplate(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}
	templateID := c.Param("id")

	var t models.AnswerTemplate
	err := h.DB.QueryRow(
		`SELECT id, organization_id, name, category, question_pattern, answer_template, created_by, usage_count, created_at, updated_at
		 FROM answer_templates
		 WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
		templateID, orgID,
	).Scan(
		&t.ID, &t.OrganizationID, &t.Name, &t.Category, &t.QuestionPattern,
		&t.AnswerTemplate, &t.CreatedBy, &t.UsageCount, &t.CreatedAt, &t.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "template not found"})
	}
	if err != nil {
		log.Printf("error getting template: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.JSON(http.StatusOK, t)
}

// UpdateTemplate handles PUT /api/templates/:id
func (h *Handler) UpdateTemplate(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}
	templateID := c.Param("id")

	var body struct {
		Name            *string `json:"name"`
		Category        *string `json:"category"`
		QuestionPattern *string `json:"question_pattern"`
		AnswerTemplate  *string `json:"answer_template"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if body.Name != nil {
		setClauses = append(setClauses, "name = $"+itoa(argIdx))
		args = append(args, *body.Name)
		argIdx++
	}
	if body.Category != nil {
		setClauses = append(setClauses, "category = $"+itoa(argIdx))
		args = append(args, *body.Category)
		argIdx++
	}
	if body.QuestionPattern != nil {
		setClauses = append(setClauses, "question_pattern = $"+itoa(argIdx))
		args = append(args, *body.QuestionPattern)
		argIdx++
	}
	if body.AnswerTemplate != nil {
		setClauses = append(setClauses, "answer_template = $"+itoa(argIdx))
		args = append(args, *body.AnswerTemplate)
		argIdx++
	}

	if len(setClauses) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "no fields to update"})
	}

	setClauses = append(setClauses, "updated_at = NOW()")

	query := "UPDATE answer_templates SET "
	for i, clause := range setClauses {
		if i > 0 {
			query += ", "
		}
		query += clause
	}
	query += " WHERE id = $" + itoa(argIdx) + " AND organization_id = $" + itoa(argIdx+1) + " AND deleted_at IS NULL"
	query += " RETURNING id, organization_id, name, category, question_pattern, answer_template, created_by, usage_count, created_at, updated_at"
	args = append(args, templateID, orgID)

	var t models.AnswerTemplate
	err := h.DB.QueryRow(query, args...).Scan(
		&t.ID, &t.OrganizationID, &t.Name, &t.Category, &t.QuestionPattern,
		&t.AnswerTemplate, &t.CreatedBy, &t.UsageCount, &t.CreatedAt, &t.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "template not found"})
	}
	if err != nil {
		log.Printf("error updating template: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.JSON(http.StatusOK, t)
}

// DeleteTemplate handles DELETE /api/templates/:id (soft delete)
func (h *Handler) DeleteTemplate(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}
	templateID := c.Param("id")

	result, err := h.DB.Exec(
		`UPDATE answer_templates SET deleted_at = NOW(), updated_at = NOW()
		 WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
		templateID, orgID,
	)
	if err != nil {
		log.Printf("error deleting template: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "template not found"})
	}

	return c.NoContent(http.StatusNoContent)
}

// SuggestTemplate handles POST /api/templates/suggest
func (h *Handler) SuggestTemplate(c echo.Context) error {
	if err := checkTemplateAccess(c); err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	var body struct {
		QuestionText string `json:"question_text"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if body.QuestionText == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "question_text is required"})
	}

	// Extract keywords from the question text (simple word-based approach)
	words := strings.Fields(strings.ToLower(body.QuestionText))
	// Filter out common stop words
	stopWords := map[string]bool{
		"the": true, "a": true, "an": true, "is": true, "are": true, "was": true,
		"were": true, "be": true, "been": true, "being": true, "have": true, "has": true,
		"had": true, "do": true, "does": true, "did": true, "will": true, "would": true,
		"could": true, "should": true, "may": true, "might": true, "shall": true,
		"can": true, "to": true, "of": true, "in": true, "for": true, "on": true,
		"with": true, "at": true, "by": true, "from": true, "as": true, "into": true,
		"about": true, "your": true, "you": true, "our": true, "we": true, "how": true,
		"what": true, "which": true, "that": true, "this": true, "it": true, "its": true,
		"and": true, "or": true, "but": true, "not": true, "no": true, "if": true,
		"describe": true, "explain": true, "provide": true, "please": true,
	}

	var keywords []string
	for _, w := range words {
		// Remove punctuation
		w = strings.Trim(w, ".,?!;:'\"()[]{}")
		if len(w) > 2 && !stopWords[w] {
			keywords = append(keywords, w)
		}
	}

	if len(keywords) == 0 {
		return c.JSON(http.StatusOK, map[string]interface{}{"suggestions": []interface{}{}})
	}

	// Build query: match any keyword in question_pattern
	query := `SELECT id, organization_id, name, category, question_pattern, answer_template, created_by, usage_count, created_at, updated_at
		 FROM answer_templates
		 WHERE organization_id = $1 AND deleted_at IS NULL AND (`
	args := []interface{}{orgID}
	argIdx := 2

	for i, kw := range keywords {
		if i > 0 {
			query += " OR "
		}
		query += "question_pattern ILIKE $" + itoa(argIdx)
		args = append(args, "%"+kw+"%")
		argIdx++
	}
	query += `) ORDER BY usage_count DESC LIMIT 10`

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		log.Printf("error suggesting templates: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	suggestions := make([]models.AnswerTemplate, 0)
	for rows.Next() {
		var t models.AnswerTemplate
		if err := rows.Scan(
			&t.ID, &t.OrganizationID, &t.Name, &t.Category, &t.QuestionPattern,
			&t.AnswerTemplate, &t.CreatedBy, &t.UsageCount, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			log.Printf("error scanning suggested template: %v", err)
			continue
		}
		suggestions = append(suggestions, t)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"suggestions": suggestions})
}
