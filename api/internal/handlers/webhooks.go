package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/spondic/api/internal/models"
)

// CreateWebhookIntegration handles POST /api/integrations/webhooks
func (h *Handler) CreateWebhookIntegration(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	var body struct {
		Platform    string   `json:"platform"`
		WebhookURL  string   `json:"webhook_url"`
		ChannelName *string  `json:"channel_name"`
		NotifyOn    []string `json:"notify_on"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	// Validate platform
	platform := strings.ToLower(body.Platform)
	if platform != "slack" && platform != "teams" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "platform must be 'slack' or 'teams'"})
	}

	// Validate webhook URL
	if body.WebhookURL == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "webhook_url is required"})
	}
	parsed, err := url.Parse(body.WebhookURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "webhook_url must be a valid HTTP(S) URL"})
	}

	// Default notify_on events
	validEvents := map[string]bool{
		"answer_approved":      true,
		"rfp_drafted":          true,
		"rfp_parsed":           true,
		"deadline_approaching": true,
	}
	if len(body.NotifyOn) == 0 {
		body.NotifyOn = []string{"answer_approved", "rfp_drafted", "rfp_parsed", "deadline_approaching"}
	}
	for _, e := range body.NotifyOn {
		if !validEvents[e] {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid event type: " + e})
		}
	}

	notifyOnJSON, _ := json.Marshal(body.NotifyOn)

	var wh models.WebhookIntegration
	err = h.DB.QueryRow(
		`INSERT INTO webhook_integrations (organization_id, platform, webhook_url, channel_name, notify_on, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, organization_id, platform, webhook_url, channel_name, is_active, notify_on, created_by, created_at, updated_at`,
		orgID, platform, body.WebhookURL, body.ChannelName, notifyOnJSON, userID,
	).Scan(
		&wh.ID, &wh.OrganizationID, &wh.Platform, &wh.WebhookURL, &wh.ChannelName,
		&wh.IsActive, &wh.NotifyOn, &wh.CreatedBy, &wh.CreatedAt, &wh.UpdatedAt,
	)
	if err != nil {
		log.Printf("error creating webhook integration: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Send a test "Connected!" message
	if h.Webhooks != nil {
		var sendErr error
		switch platform {
		case "slack":
			sendErr = h.Webhooks.SendSlackMessage(body.WebhookURL, "RFPDraft Connected!", "This Slack channel is now connected to RFPDraft notifications.")
		case "teams":
			sendErr = h.Webhooks.SendTeamsMessage(body.WebhookURL, "RFPDraft Connected!", "This Teams channel is now connected to RFPDraft notifications.")
		}
		if sendErr != nil {
			log.Printf("warning: test webhook message failed for integration %s: %v", wh.ID, sendErr)
			// Don't fail the creation — just log the warning
		}
	}

	return c.JSON(http.StatusCreated, wh)
}

// ListWebhookIntegrations handles GET /api/integrations/webhooks
func (h *Handler) ListWebhookIntegrations(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	rows, err := h.DB.Query(
		`SELECT id, organization_id, platform, webhook_url, channel_name, is_active, notify_on, created_by, created_at, updated_at
		 FROM webhook_integrations
		 WHERE organization_id = $1
		 ORDER BY created_at DESC`,
		orgID,
	)
	if err != nil {
		log.Printf("error listing webhook integrations: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	webhooks := make([]models.WebhookIntegration, 0)
	for rows.Next() {
		var wh models.WebhookIntegration
		if err := rows.Scan(
			&wh.ID, &wh.OrganizationID, &wh.Platform, &wh.WebhookURL, &wh.ChannelName,
			&wh.IsActive, &wh.NotifyOn, &wh.CreatedBy, &wh.CreatedAt, &wh.UpdatedAt,
		); err != nil {
			log.Printf("error scanning webhook integration: %v", err)
			continue
		}
		webhooks = append(webhooks, wh)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"webhooks": webhooks,
	})
}

// UpdateWebhookIntegration handles PUT /api/integrations/webhooks/:id
func (h *Handler) UpdateWebhookIntegration(c echo.Context) error {
	orgID := getOrgID(c)
	whID := c.Param("id")
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	var body struct {
		WebhookURL  *string  `json:"webhook_url"`
		ChannelName *string  `json:"channel_name"`
		IsActive    *bool    `json:"is_active"`
		NotifyOn    []string `json:"notify_on"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	// Build dynamic update
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if body.WebhookURL != nil {
		parsed, err := url.Parse(*body.WebhookURL)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "webhook_url must be a valid HTTP(S) URL"})
		}
		setClauses = append(setClauses, "webhook_url = $"+itoa(argIdx))
		args = append(args, *body.WebhookURL)
		argIdx++
	}
	if body.ChannelName != nil {
		setClauses = append(setClauses, "channel_name = $"+itoa(argIdx))
		args = append(args, *body.ChannelName)
		argIdx++
	}
	if body.IsActive != nil {
		setClauses = append(setClauses, "is_active = $"+itoa(argIdx))
		args = append(args, *body.IsActive)
		argIdx++
	}
	if len(body.NotifyOn) > 0 {
		validEvents := map[string]bool{
			"answer_approved": true, "rfp_drafted": true,
			"rfp_parsed": true, "deadline_approaching": true,
		}
		for _, e := range body.NotifyOn {
			if !validEvents[e] {
				return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid event type: " + e})
			}
		}
		notifyOnJSON, _ := json.Marshal(body.NotifyOn)
		setClauses = append(setClauses, "notify_on = $"+itoa(argIdx))
		args = append(args, notifyOnJSON)
		argIdx++
	}

	if len(setClauses) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "no fields to update"})
	}

	setClauses = append(setClauses, "updated_at = NOW()")

	query := "UPDATE webhook_integrations SET "
	for i, clause := range setClauses {
		if i > 0 {
			query += ", "
		}
		query += clause
	}
	query += " WHERE id = $" + itoa(argIdx) + " AND organization_id = $" + itoa(argIdx+1)
	query += " RETURNING id, organization_id, platform, webhook_url, channel_name, is_active, notify_on, created_by, created_at, updated_at"
	args = append(args, whID, orgID)

	var wh models.WebhookIntegration
	err := h.DB.QueryRow(query, args...).Scan(
		&wh.ID, &wh.OrganizationID, &wh.Platform, &wh.WebhookURL, &wh.ChannelName,
		&wh.IsActive, &wh.NotifyOn, &wh.CreatedBy, &wh.CreatedAt, &wh.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "webhook integration not found"})
	}
	if err != nil {
		log.Printf("error updating webhook integration: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.JSON(http.StatusOK, wh)
}

// DeleteWebhookIntegration handles DELETE /api/integrations/webhooks/:id
func (h *Handler) DeleteWebhookIntegration(c echo.Context) error {
	orgID := getOrgID(c)
	whID := c.Param("id")
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	result, err := h.DB.Exec(
		`DELETE FROM webhook_integrations WHERE id = $1 AND organization_id = $2`,
		whID, orgID,
	)
	if err != nil {
		log.Printf("error deleting webhook integration: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	affected, _ := result.RowsAffected()
	if affected == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "webhook integration not found"})
	}

	return c.NoContent(http.StatusNoContent)
}

// TestWebhookIntegration handles POST /api/integrations/webhooks/:id/test
func (h *Handler) TestWebhookIntegration(c echo.Context) error {
	orgID := getOrgID(c)
	whID := c.Param("id")
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	var platform, webhookURL string
	err := h.DB.QueryRow(
		`SELECT platform, webhook_url FROM webhook_integrations WHERE id = $1 AND organization_id = $2`,
		whID, orgID,
	).Scan(&platform, &webhookURL)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "webhook integration not found"})
	}
	if err != nil {
		log.Printf("error fetching webhook integration: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	if h.Webhooks == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "webhook service not configured"})
	}

	var sendErr error
	switch strings.ToLower(platform) {
	case "slack":
		sendErr = h.Webhooks.SendSlackMessage(webhookURL, "RFPDraft Test", "This is a test notification from RFPDraft. Your webhook is working correctly!")
	case "teams":
		sendErr = h.Webhooks.SendTeamsMessage(webhookURL, "RFPDraft Test", "This is a test notification from RFPDraft. Your webhook is working correctly!")
	default:
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "unknown platform"})
	}

	if sendErr != nil {
		log.Printf("test webhook failed for integration %s: %v", whID, sendErr)
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "webhook test failed: " + sendErr.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "sent"})
}
