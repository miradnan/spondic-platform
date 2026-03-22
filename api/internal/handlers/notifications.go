package handlers

// Routes to register in main.go:
// api.GET("/notifications", h.ListNotifications)
// api.GET("/notifications/unread-count", h.UnreadCount)
// api.PUT("/notifications/:id/read", h.MarkNotificationRead)
// api.PUT("/notifications/read-all", h.MarkAllNotificationsRead)
// api.GET("/notifications/preferences", h.GetNotificationPreferences)
// api.PUT("/notifications/preferences", h.UpdateNotificationPreference)
//
// Handler struct needs: Notifier *services.NotificationService

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/spondic/api/internal/models"
)

// ListNotifications handles GET /api/notifications
func (h *Handler) ListNotifications(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	page, limit, offset := paginationParams(c)
	unreadOnly := c.QueryParam("unread_only") == "true"

	// Count total
	countQuery := `SELECT COUNT(*) FROM notifications WHERE organization_id = $1 AND user_id = $2`
	args := []interface{}{orgID, userID}

	if unreadOnly {
		countQuery += ` AND is_read = false`
	}

	var total int64
	if err := h.DB.QueryRow(countQuery, args...).Scan(&total); err != nil {
		log.Printf("error counting notifications: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Fetch notifications
	query := `SELECT id, organization_id, user_id, type, title, body, entity_type, entity_id, is_read, email_sent, created_at
		FROM notifications
		WHERE organization_id = $1 AND user_id = $2`

	fetchArgs := []interface{}{orgID, userID}
	fetchIdx := 3

	if unreadOnly {
		query += ` AND is_read = false`
	}

	query += ` ORDER BY created_at DESC LIMIT $` + strconv.Itoa(fetchIdx) + ` OFFSET $` + strconv.Itoa(fetchIdx+1)
	fetchArgs = append(fetchArgs, limit, offset)

	rows, err := h.DB.Query(query, fetchArgs...)
	if err != nil {
		log.Printf("error listing notifications: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	notifications := make([]models.Notification, 0)
	for rows.Next() {
		var n models.Notification
		if err := rows.Scan(
			&n.ID, &n.OrganizationID, &n.UserID, &n.Type, &n.Title, &n.Body,
			&n.EntityType, &n.EntityID, &n.IsRead, &n.EmailSent, &n.CreatedAt,
		); err != nil {
			log.Printf("error scanning notification: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		}
		notifications = append(notifications, n)
	}

	return c.JSON(http.StatusOK, models.PaginatedResponse{
		Data: notifications,
		Pagination: models.Pagination{
			Page:       page,
			Limit:      limit,
			Total:      total,
			TotalPages: totalPages(total, limit),
		},
	})
}

// UnreadCount handles GET /api/notifications/unread-count
func (h *Handler) UnreadCount(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	var count int64
	err := h.DB.QueryRow(
		`SELECT COUNT(*) FROM notifications WHERE organization_id = $1 AND user_id = $2 AND is_read = false`,
		orgID, userID,
	).Scan(&count)
	if err != nil {
		log.Printf("error counting unread notifications: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.JSON(http.StatusOK, map[string]int64{"count": count})
}

// MarkNotificationRead handles PUT /api/notifications/:id/read
func (h *Handler) MarkNotificationRead(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	notifID := c.Param("id")
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	var n models.Notification
	err := h.DB.QueryRow(
		`UPDATE notifications SET is_read = true
		 WHERE id = $1 AND user_id = $2 AND organization_id = $3
		 RETURNING id, organization_id, user_id, type, title, body, entity_type, entity_id, is_read, email_sent, created_at`,
		notifID, userID, orgID,
	).Scan(
		&n.ID, &n.OrganizationID, &n.UserID, &n.Type, &n.Title, &n.Body,
		&n.EntityType, &n.EntityID, &n.IsRead, &n.EmailSent, &n.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "notification not found"})
	}
	if err != nil {
		log.Printf("error marking notification read: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.JSON(http.StatusOK, n)
}

// MarkAllNotificationsRead handles PUT /api/notifications/read-all
func (h *Handler) MarkAllNotificationsRead(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	result, err := h.DB.Exec(
		`UPDATE notifications SET is_read = true
		 WHERE user_id = $1 AND organization_id = $2 AND is_read = false`,
		userID, orgID,
	)
	if err != nil {
		log.Printf("error marking all notifications read: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	updated, _ := result.RowsAffected()
	return c.JSON(http.StatusOK, map[string]int64{"updated": updated})
}

// GetNotificationPreferences handles GET /api/notifications/preferences
func (h *Handler) GetNotificationPreferences(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	rows, err := h.DB.Query(
		`SELECT organization_id, user_id, type, in_app_enabled, email_enabled
		 FROM notification_preferences
		 WHERE organization_id = $1 AND user_id = $2
		 ORDER BY type`,
		orgID, userID,
	)
	if err != nil {
		log.Printf("error listing notification preferences: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	prefs := make([]models.NotificationPreference, 0)
	for rows.Next() {
		var p models.NotificationPreference
		if err := rows.Scan(&p.OrganizationID, &p.UserID, &p.Type, &p.InAppEnabled, &p.EmailEnabled); err != nil {
			log.Printf("error scanning notification preference: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		}
		prefs = append(prefs, p)
	}

	return c.JSON(http.StatusOK, prefs)
}

// UpdateNotificationPreference handles PUT /api/notifications/preferences
func (h *Handler) UpdateNotificationPreference(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	var body struct {
		Type         string `json:"type"`
		InAppEnabled bool   `json:"in_app_enabled"`
		EmailEnabled bool   `json:"email_enabled"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if body.Type == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "type is required"})
	}

	var pref models.NotificationPreference
	err := h.DB.QueryRow(
		`INSERT INTO notification_preferences (organization_id, user_id, type, in_app_enabled, email_enabled)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (organization_id, user_id, type)
		 DO UPDATE SET in_app_enabled = EXCLUDED.in_app_enabled, email_enabled = EXCLUDED.email_enabled
		 RETURNING organization_id, user_id, type, in_app_enabled, email_enabled`,
		orgID, userID, body.Type, body.InAppEnabled, body.EmailEnabled,
	).Scan(&pref.OrganizationID, &pref.UserID, &pref.Type, &pref.InAppEnabled, &pref.EmailEnabled)
	if err != nil {
		log.Printf("error upserting notification preference: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.JSON(http.StatusOK, pref)
}
