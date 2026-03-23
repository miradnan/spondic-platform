package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/spondic/api/internal/middleware"
)

// superAdminUserID is the hardcoded Clerk user ID allowed to access superadmin endpoints.
const superAdminUserID = "user_3BHZZeo8iDZIaxRhNabRli1l5HA"

// SuperAdminAuth is middleware that checks the authenticated user is the superadmin.
// Must be used after ClerkAuth middleware.
func SuperAdminAuth(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := middleware.GetUserID(c)
		if userID != superAdminUserID {
			return c.JSON(http.StatusForbidden, map[string]string{"error": "superadmin access only"})
		}
		return next(c)
	}
}

// AdminUpgradePlan handles POST /admin/upgrade-plan
// Updates both the subscriptions table and Clerk org metadata.
func (h *Handler) AdminUpgradePlan(c echo.Context) error {
	var body struct {
		OrgID    string `json:"org_id"`
		Plan     string `json:"plan"`
		Duration string `json:"duration"` // e.g. "1y", "6m", "30d" — defaults to 1y
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if body.OrgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "org_id is required"})
	}

	allowedPlans := map[string]bool{
		"free": true, "free_org": true, "starter": true, "growth": true, "enterprise": true,
	}
	if !allowedPlans[body.Plan] {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "invalid plan — must be one of: free, free_org, starter, growth, enterprise",
		})
	}

	// Parse duration
	duration := 365 * 24 * time.Hour // default 1 year
	if body.Duration != "" {
		d, err := parseDuration(body.Duration)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
		}
		duration = d
	}

	periodEnd := time.Now().Add(duration)

	// 1. Upsert subscriptions table
	_, err := h.DB.Exec(
		`INSERT INTO subscriptions (organization_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_start, current_period_end)
		 VALUES ($1, 'manual_admin', 'manual_' || gen_random_uuid(), $2, 'active', NOW(), $3)
		 ON CONFLICT (organization_id) DO UPDATE SET
		   plan = $2,
		   status = 'active',
		   current_period_start = NOW(),
		   current_period_end = $3,
		   canceled_at = NULL,
		   cancel_at = NULL,
		   updated_at = NOW()`,
		body.OrgID, body.Plan, periodEnd,
	)
	if err != nil {
		log.Printf("error upserting subscription for org %s: %v", body.OrgID, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update subscription: " + err.Error()})
	}

	// 2. Update Clerk org metadata so the JWT pla claim reflects the new plan
	clerkErr := updateClerkOrgPlan(body.OrgID, body.Plan)
	if clerkErr != nil {
		log.Printf("warning: updated DB but failed to update Clerk for org %s: %v", body.OrgID, clerkErr)
		return c.JSON(http.StatusOK, map[string]interface{}{
			"status":       "partial",
			"message":      "Subscription updated in DB but Clerk metadata update failed. Users may need to re-login.",
			"clerk_error":  clerkErr.Error(),
			"org_id":       body.OrgID,
			"plan":         body.Plan,
			"period_end":   periodEnd.Format(time.RFC3339),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"status":     "ok",
		"org_id":     body.OrgID,
		"plan":       body.Plan,
		"period_end": periodEnd.Format(time.RFC3339),
	})
}

// AdminListOrgs handles GET /admin/orgs — lists all orgs with plan info.
func (h *Handler) AdminListOrgs(c echo.Context) error {
	rows, err := h.DB.Query(
		`SELECT o.clerk_org_id,
		        COALESCE(s.plan, 'free') AS plan,
		        COALESCE(s.status, 'none') AS status,
		        s.current_period_end,
		        (SELECT COUNT(*) FROM projects p WHERE p.organization_id = o.clerk_org_id) AS projects,
		        (SELECT COUNT(*) FROM documents d WHERE d.organization_id = o.clerk_org_id AND d.deleted_at IS NULL) AS documents
		 FROM organizations o
		 LEFT JOIN subscriptions s ON s.organization_id = o.clerk_org_id
		 ORDER BY o.created_at DESC`,
	)
	if err != nil {
		log.Printf("error listing orgs: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	type orgRow struct {
		OrgID     string     `json:"org_id"`
		Plan      string     `json:"plan"`
		Status    string     `json:"status"`
		PeriodEnd *time.Time `json:"period_end,omitempty"`
		Projects  int        `json:"projects"`
		Documents int        `json:"documents"`
	}
	orgs := make([]orgRow, 0)
	for rows.Next() {
		var o orgRow
		if err := rows.Scan(&o.OrgID, &o.Plan, &o.Status, &o.PeriodEnd, &o.Projects, &o.Documents); err != nil {
			log.Printf("error scanning org row: %v", err)
			continue
		}
		orgs = append(orgs, o)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"orgs":  orgs,
		"total": len(orgs),
	})
}

// AdminGetOrg handles GET /admin/orgs/:id — detailed info for one org.
func (h *Handler) AdminGetOrg(c echo.Context) error {
	orgID := c.Param("id")

	type orgDetail struct {
		OrgID     string     `json:"org_id"`
		Plan      string     `json:"plan"`
		Status    string     `json:"status"`
		PeriodStart *time.Time `json:"period_start,omitempty"`
		PeriodEnd   *time.Time `json:"period_end,omitempty"`
		CancelAt    *time.Time `json:"cancel_at,omitempty"`
		StripeCustomerID     *string `json:"stripe_customer_id,omitempty"`
		StripeSubscriptionID *string `json:"stripe_subscription_id,omitempty"`
		Projects   int `json:"projects"`
		Documents  int `json:"documents"`
		Questions  int `json:"questions_drafted"`
		Members    int `json:"members"`
	}

	var o orgDetail
	o.OrgID = orgID

	err := h.DB.QueryRow(
		`SELECT COALESCE(s.plan, 'free'), COALESCE(s.status, 'none'),
		        s.current_period_start, s.current_period_end, s.cancel_at,
		        s.stripe_customer_id, s.stripe_subscription_id
		 FROM subscriptions s WHERE s.organization_id = $1`, orgID,
	).Scan(&o.Plan, &o.Status, &o.PeriodStart, &o.PeriodEnd, &o.CancelAt,
		&o.StripeCustomerID, &o.StripeSubscriptionID)
	if err == sql.ErrNoRows {
		o.Plan = "free"
		o.Status = "none"
	} else if err != nil {
		log.Printf("error fetching org subscription: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	h.DB.QueryRow(`SELECT COUNT(*) FROM projects WHERE organization_id = $1`, orgID).Scan(&o.Projects)
	h.DB.QueryRow(`SELECT COUNT(*) FROM documents WHERE organization_id = $1 AND deleted_at IS NULL`, orgID).Scan(&o.Documents)
	h.DB.QueryRow(`SELECT COUNT(DISTINCT a.question_id) FROM rfp_answers a WHERE a.organization_id = $1`, orgID).Scan(&o.Questions)
	h.DB.QueryRow(`SELECT COUNT(DISTINCT tm.user_id) FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE t.organization_id = $1 AND t.deleted_at IS NULL`, orgID).Scan(&o.Members)

	return c.JSON(http.StatusOK, o)
}

// updateClerkOrgPlan calls the Clerk Backend API to update the org's public metadata with the plan.
func updateClerkOrgPlan(orgID, plan string) error {
	if clerkSecretKey == "" {
		return fmt.Errorf("CLERK_SECRET_KEY not configured")
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"public_metadata": map[string]string{
			"plan": plan,
		},
	})

	req, err := http.NewRequest("PATCH",
		"https://api.clerk.com/v1/organizations/"+orgID,
		bytes.NewReader(payload),
	)
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+clerkSecretKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return fmt.Errorf("calling Clerk API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Clerk API returned %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	return nil
}

// parseDuration parses "1y", "6m", "30d" style durations.
func parseDuration(s string) (time.Duration, error) {
	if len(s) < 2 {
		return 0, fmt.Errorf("invalid duration %q — use format like 1y, 6m, 30d", s)
	}
	numStr := s[:len(s)-1]
	unit := s[len(s)-1]

	var num int
	for _, c := range numStr {
		if c < '0' || c > '9' {
			return 0, fmt.Errorf("invalid duration %q — use format like 1y, 6m, 30d", s)
		}
		num = num*10 + int(c-'0')
	}
	if num <= 0 {
		return 0, fmt.Errorf("duration must be positive")
	}

	switch unit {
	case 'd':
		return time.Duration(num) * 24 * time.Hour, nil
	case 'm':
		return time.Duration(num) * 30 * 24 * time.Hour, nil
	case 'y':
		return time.Duration(num) * 365 * 24 * time.Hour, nil
	default:
		return 0, fmt.Errorf("invalid duration unit %q — use d, m, or y", string(unit))
	}
}
