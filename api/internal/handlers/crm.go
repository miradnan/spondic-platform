package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/spondic/api/internal/services"
)

// ── CRM Connection Endpoints ────────────────────────────────────────────────

// ListCRMConnections returns all CRM connections for the current org.
func (h *Handler) ListCRMConnections(c echo.Context) error {
	orgID := getOrgID(c)
	crm := services.NewCRMService(h.DB)

	connections, err := crm.ListConnections(c.Request().Context(), orgID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if connections == nil {
		connections = []services.CRMConnection{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"connections": connections})
}

// ConnectCRM initiates a CRM connection (placeholder for OAuth flow).
func (h *Handler) ConnectCRM(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)

	var body struct {
		Platform string `json:"platform"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if body.Platform != "salesforce" && body.Platform != "hubspot" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "platform must be 'salesforce' or 'hubspot'"})
	}

	crm := services.NewCRMService(h.DB)
	conn, err := crm.Connect(c.Request().Context(), orgID, body.Platform, userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"connection": conn,
		"status":     "connected",
		"message":    "OAuth flow required for production use. Connection record created as placeholder.",
	})
}

// DisconnectCRM deactivates a CRM connection.
func (h *Handler) DisconnectCRM(c echo.Context) error {
	orgID := getOrgID(c)
	connectionID := c.Param("id")

	crm := services.NewCRMService(h.DB)
	if err := crm.Disconnect(c.Request().Context(), orgID, connectionID); err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": err.Error()})
	}

	return c.NoContent(http.StatusNoContent)
}

// SyncCRM triggers a sync for a CRM connection (placeholder).
func (h *Handler) SyncCRM(c echo.Context) error {
	orgID := getOrgID(c)

	var body struct {
		ProjectID string `json:"project_id"`
	}
	if err := c.Bind(&body); err != nil || body.ProjectID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "project_id is required"})
	}

	crm := services.NewCRMService(h.DB)
	if err := crm.SyncDeal(c.Request().Context(), orgID, body.ProjectID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "synced", "message": "Sync completed (placeholder — actual CRM API calls require OAuth tokens)"})
}

// ── Project CRM Link Endpoints ──────────────────────────────────────────────

// GetProjectCRMLink returns the CRM deal linked to a project.
func (h *Handler) GetProjectCRMLink(c echo.Context) error {
	orgID := getOrgID(c)
	projectID := c.Param("id")

	crm := services.NewCRMService(h.DB)
	link, err := crm.GetProjectCRMLink(c.Request().Context(), orgID, projectID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if link == nil {
		return c.JSON(http.StatusOK, map[string]interface{}{"link": nil})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"link": link})
}

// LinkProjectToCRM links a project to a CRM deal.
func (h *Handler) LinkProjectToCRM(c echo.Context) error {
	orgID := getOrgID(c)
	projectID := c.Param("id")

	var body struct {
		Platform     string   `json:"platform"`
		CRMDealID    string   `json:"crm_deal_id"`
		CRMDealName  *string  `json:"crm_deal_name"`
		CRMDealStage *string  `json:"crm_deal_stage"`
		CRMDealAmount *float64 `json:"crm_deal_amount"`
		Currency     string   `json:"currency"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if body.Platform == "" || body.CRMDealID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "platform and crm_deal_id are required"})
	}
	if body.Platform != "salesforce" && body.Platform != "hubspot" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "platform must be 'salesforce' or 'hubspot'"})
	}

	currency := body.Currency
	if currency == "" {
		currency = "USD"
	}

	linkInput := &services.ProjectCRMLink{
		Platform:        body.Platform,
		CRMDealID:       body.CRMDealID,
		CRMDealName:     body.CRMDealName,
		CRMDealStage:    body.CRMDealStage,
		CRMDealAmount:   body.CRMDealAmount,
		CRMDealCurrency: currency,
	}

	crm := services.NewCRMService(h.DB)
	link, err := crm.LinkProjectToDeal(c.Request().Context(), orgID, projectID, linkInput)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{"link": link})
}

// UnlinkProjectFromCRM removes the CRM deal link from a project.
func (h *Handler) UnlinkProjectFromCRM(c echo.Context) error {
	orgID := getOrgID(c)
	projectID := c.Param("id")

	crm := services.NewCRMService(h.DB)
	if err := crm.UnlinkProjectFromDeal(c.Request().Context(), orgID, projectID); err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": err.Error()})
	}

	return c.NoContent(http.StatusNoContent)
}
