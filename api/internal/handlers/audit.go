package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/spondic/api/internal/models"
)

// ListAuditLogs handles GET /api/audit-logs (admin only)
func (h *Handler) ListAuditLogs(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	page, limit, offset := paginationParams(c)
	actionFilter := c.QueryParam("action")
	userFilter := c.QueryParam("user_id")
	entityTypeFilter := c.QueryParam("entity_type")

	// Build count query
	countQuery := `SELECT COUNT(*) FROM audit_logs WHERE organization_id = $1`
	args := []interface{}{orgID}
	argIdx := 2

	if actionFilter != "" {
		countQuery += " AND action = $" + itoa(argIdx)
		args = append(args, actionFilter)
		argIdx++
	}
	if userFilter != "" {
		countQuery += " AND user_id = $" + itoa(argIdx)
		args = append(args, userFilter)
		argIdx++
	}
	if entityTypeFilter != "" {
		countQuery += " AND entity_type = $" + itoa(argIdx)
		args = append(args, entityTypeFilter)
		argIdx++
	}

	var total int64
	if err := h.DB.QueryRow(countQuery, args...).Scan(&total); err != nil {
		log.Printf("error counting audit logs: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Build fetch query
	fetchQuery := `SELECT id, organization_id, user_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at
	               FROM audit_logs WHERE organization_id = $1`

	fetchArgs := []interface{}{orgID}
	fetchIdx := 2

	if actionFilter != "" {
		fetchQuery += " AND action = $" + itoa(fetchIdx)
		fetchArgs = append(fetchArgs, actionFilter)
		fetchIdx++
	}
	if userFilter != "" {
		fetchQuery += " AND user_id = $" + itoa(fetchIdx)
		fetchArgs = append(fetchArgs, userFilter)
		fetchIdx++
	}
	if entityTypeFilter != "" {
		fetchQuery += " AND entity_type = $" + itoa(fetchIdx)
		fetchArgs = append(fetchArgs, entityTypeFilter)
		fetchIdx++
	}

	fetchQuery += " ORDER BY created_at DESC LIMIT $" + itoa(fetchIdx) + " OFFSET $" + itoa(fetchIdx+1)
	fetchArgs = append(fetchArgs, limit, offset)

	rows, err := h.DB.Query(fetchQuery, fetchArgs...)
	if err != nil {
		log.Printf("error listing audit logs: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	logs := make([]models.AuditLog, 0)
	for rows.Next() {
		var l models.AuditLog
		var metadataJSON *string

		if err := rows.Scan(
			&l.ID, &l.OrganizationID, &l.UserID, &l.Action,
			&l.EntityType, &l.EntityID, &metadataJSON,
			&l.IPAddress, &l.UserAgent, &l.CreatedAt,
		); err != nil {
			log.Printf("error scanning audit log: %v", err)
			continue
		}

		if metadataJSON != nil {
			json.Unmarshal([]byte(*metadataJSON), &l.Metadata)
		}

		logs = append(logs, l)
	}

	return c.JSON(http.StatusOK, models.PaginatedResponse{
		Data: logs,
		Pagination: models.Pagination{
			Page:       page,
			Limit:      limit,
			Total:      total,
			TotalPages: totalPages(total, limit),
		},
	})
}
