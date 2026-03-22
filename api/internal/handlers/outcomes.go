package handlers

// outcomes.go routes:
// api.POST("/projects/:id/outcome", h.RecordOutcome)
// api.GET("/analytics/win-loss", h.GetWinLossAnalytics)

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/spondic/api/internal/models"
)

// RecordOutcome handles POST /api/projects/:id/outcome
func (h *Handler) RecordOutcome(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}
	projectID := c.Param("id")

	var body struct {
		Outcome      string  `json:"outcome"`
		RevenueCents *int64  `json:"revenue_cents"`
		Currency     string  `json:"currency"`
		Feedback     *string `json:"feedback"`
		LossReason   *string `json:"loss_reason"`
		SubmittedAt  *string `json:"submitted_at"`
		DecidedAt    *string `json:"decided_at"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	// Validate outcome
	validOutcomes := map[string]bool{"won": true, "lost": true, "no_decision": true, "pending": true}
	if !validOutcomes[body.Outcome] {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "outcome must be one of: won, lost, no_decision, pending"})
	}

	if body.Currency == "" {
		body.Currency = "usd"
	}

	// Verify project belongs to org
	var exists bool
	err := h.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL)`,
		projectID, orgID,
	).Scan(&exists)
	if err != nil || !exists {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "project not found"})
	}

	// Parse optional timestamps
	var submittedAt, decidedAt *time.Time
	if body.SubmittedAt != nil && *body.SubmittedAt != "" {
		t, err := time.Parse(time.RFC3339, *body.SubmittedAt)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "submitted_at must be RFC3339 format"})
		}
		submittedAt = &t
	}
	if body.DecidedAt != nil && *body.DecidedAt != "" {
		t, err := time.Parse(time.RFC3339, *body.DecidedAt)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "decided_at must be RFC3339 format"})
		}
		decidedAt = &t
	}

	var outcome models.ProjectOutcome
	err = h.DB.QueryRow(
		`INSERT INTO project_outcomes (project_id, organization_id, outcome, revenue_cents, currency, feedback, loss_reason, submitted_at, decided_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (project_id) DO UPDATE SET
		   outcome = EXCLUDED.outcome,
		   revenue_cents = EXCLUDED.revenue_cents,
		   currency = EXCLUDED.currency,
		   feedback = EXCLUDED.feedback,
		   loss_reason = EXCLUDED.loss_reason,
		   submitted_at = EXCLUDED.submitted_at,
		   decided_at = EXCLUDED.decided_at,
		   updated_at = NOW()
		 RETURNING id, project_id, organization_id, outcome, revenue_cents, currency, feedback, loss_reason, submitted_at, decided_at, created_at, updated_at`,
		projectID, orgID, body.Outcome, body.RevenueCents, body.Currency, body.Feedback, body.LossReason, submittedAt, decidedAt,
	).Scan(
		&outcome.ID, &outcome.ProjectID, &outcome.OrganizationID, &outcome.Outcome,
		&outcome.RevenueCents, &outcome.Currency, &outcome.Feedback, &outcome.LossReason,
		&outcome.SubmittedAt, &outcome.DecidedAt, &outcome.CreatedAt, &outcome.UpdatedAt,
	)
	if err != nil {
		log.Printf("error upserting project outcome: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.JSON(http.StatusCreated, outcome)
}

// GetWinLossAnalytics handles GET /api/analytics/win-loss
func (h *Handler) GetWinLossAnalytics(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	periodStart := c.QueryParam("period_start")
	periodEnd := c.QueryParam("period_end")

	// Parse optional date filters (pass as *string for nullable SQL params)
	var pStart, pEnd *string
	if periodStart != "" {
		pStart = &periodStart
	}
	if periodEnd != "" {
		pEnd = &periodEnd
	}

	// Aggregate counts and revenue
	var total, won, lost, noDecision int
	var totalRevenueCents int64
	var avgDays *float64

	err := h.DB.QueryRow(
		`SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE outcome = 'won') AS won,
			COUNT(*) FILTER (WHERE outcome = 'lost') AS lost,
			COUNT(*) FILTER (WHERE outcome = 'no_decision') AS no_decision,
			COALESCE(SUM(revenue_cents) FILTER (WHERE outcome = 'won'), 0) AS total_revenue_cents,
			AVG(EXTRACT(EPOCH FROM (decided_at - submitted_at))/86400) FILTER (WHERE decided_at IS NOT NULL AND submitted_at IS NOT NULL) AS avg_days_to_decision
		 FROM project_outcomes
		 WHERE organization_id = $1
		   AND ($2::date IS NULL OR created_at >= $2::date)
		   AND ($3::date IS NULL OR created_at <= $3::date)`,
		orgID, pStart, pEnd,
	).Scan(&total, &won, &lost, &noDecision, &totalRevenueCents, &avgDays)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("error fetching win/loss analytics: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Calculate win rate (avoid division by zero)
	var winRate float64
	if won+lost > 0 {
		winRate = float64(won) / float64(won+lost) * 100
	}

	avgResponseDays := 0.0
	if avgDays != nil {
		avgResponseDays = *avgDays
	}

	// Query loss reasons
	lossReasons := make(map[string]int)
	rows, err := h.DB.Query(
		`SELECT COALESCE(loss_reason, 'unknown'), COUNT(*)
		 FROM project_outcomes
		 WHERE outcome = 'lost' AND organization_id = $1
		   AND ($2::date IS NULL OR created_at >= $2::date)
		   AND ($3::date IS NULL OR created_at <= $3::date)
		 GROUP BY loss_reason`,
		orgID, pStart, pEnd,
	)
	if err != nil {
		log.Printf("error fetching loss reasons: %v", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var reason string
			var count int
			if err := rows.Scan(&reason, &count); err != nil {
				log.Printf("error scanning loss reason: %v", err)
				continue
			}
			lossReasons[reason] = count
		}
	}

	analytics := models.WinLossAnalytics{
		WinRate:         winRate,
		TotalWon:        won,
		TotalLost:       lost,
		TotalRevenue:    totalRevenueCents,
		AvgResponseDays: avgResponseDays,
		LossReasons:     lossReasons,
	}

	return c.JSON(http.StatusOK, analytics)
}
