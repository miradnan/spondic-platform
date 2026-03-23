package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"math"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/spondic/api/internal/events"
	"github.com/spondic/api/internal/middleware"
	"github.com/spondic/api/internal/services"
)

// Handler holds shared dependencies for all route handlers.
type Handler struct {
	DB       *sql.DB
	S3       *services.S3Client
	AI       *services.AIClient
	S3Bucket string
	Notifier *services.NotificationService
	Webhooks *services.WebhookService
	Events   *events.Bus
}

// NewHandler constructs a Handler with the given dependencies.
func NewHandler(db *sql.DB, s3 *services.S3Client, ai *services.AIClient, bucket string) *Handler {
	return &Handler{
		DB:       db,
		S3:       s3,
		AI:       ai,
		S3Bucket: bucket,
	}
}

// getUserID extracts the user ID from the Echo context (set by auth middleware).
func getUserID(c echo.Context) string {
	return middleware.GetUserID(c)
}

// getOrgID extracts the organization ID from the Echo context (set by auth middleware).
func getOrgID(c echo.Context) string {
	return middleware.GetOrgID(c)
}

// getOrgRole extracts the user's organization role from the Echo context (set by auth middleware).
func getOrgRole(c echo.Context) string {
	return middleware.GetOrgRole(c)
}

// isAdmin returns true if the user has the admin role in the organization.
func isAdmin(c echo.Context) bool {
	role := getOrgRole(c)
	return role == "admin" || role == "org:admin"
}

// paginationParams extracts page and limit from query params with defaults.
func paginationParams(c echo.Context) (int, int, int) {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit
	return page, limit, offset
}

// totalPages calculates the number of pages.
func totalPages(total int64, limit int) int {
	return int(math.Ceil(float64(total) / float64(limit)))
}

// checkDocumentLimit checks if the org has reached their plan's max_documents limit.
func (h *Handler) checkDocumentLimit(c echo.Context, orgID string) error {
	limits := middleware.GetPlanLimits(c)
	if limits == nil || limits.MaxDocuments == nil {
		return nil // no limit or unlimited
	}
	var count int
	err := h.DB.QueryRow(
		`SELECT COUNT(*) FROM documents WHERE organization_id = $1 AND deleted_at IS NULL`,
		orgID,
	).Scan(&count)
	if err != nil {
		log.Printf("error counting documents for limit check: %v", err)
		return nil // fail-open
	}
	if count >= *limits.MaxDocuments {
		return fmt.Errorf("document limit reached (%d/%d). Upgrade your plan to upload more documents", count, *limits.MaxDocuments)
	}
	return nil
}

// checkRFPLimit checks if the org has reached their plan's max_rfps_per_month limit.
func (h *Handler) checkRFPLimit(c echo.Context, orgID string) error {
	limits := middleware.GetPlanLimits(c)
	if limits == nil || limits.MaxRFPs == nil {
		return nil
	}
	var count int
	err := h.DB.QueryRow(
		`SELECT COUNT(*) FROM projects WHERE organization_id = $1 AND deleted_at IS NULL
		 AND created_at >= DATE_TRUNC('month', NOW())`,
		orgID,
	).Scan(&count)
	if err != nil {
		log.Printf("error counting RFPs for limit check: %v", err)
		return nil
	}
	if count >= *limits.MaxRFPs {
		return fmt.Errorf("monthly RFP limit reached (%d/%d). Upgrade your plan to create more RFPs", count, *limits.MaxRFPs)
	}
	return nil
}

// checkUserLimit checks if the org has reached their plan's max_users limit.
func (h *Handler) checkUserLimit(c echo.Context, orgID string) error {
	limits := middleware.GetPlanLimits(c)
	if limits == nil || limits.MaxUsers == nil {
		return nil
	}
	var count int
	err := h.DB.QueryRow(
		`SELECT COUNT(DISTINCT user_id) FROM team_members tm
		 JOIN teams t ON t.id = tm.team_id
		 WHERE t.organization_id = $1 AND t.deleted_at IS NULL`,
		orgID,
	).Scan(&count)
	if err != nil {
		log.Printf("error counting users for limit check: %v", err)
		return nil
	}
	if count >= *limits.MaxUsers {
		return fmt.Errorf("team member limit reached (%d/%d). Upgrade your plan to add more members", count, *limits.MaxUsers)
	}
	return nil
}

// checkQuestionLimit checks if a project has reached the plan's max_questions_per_rfp limit.
func (h *Handler) checkQuestionLimit(c echo.Context, orgID, projectID string) (int, error) {
	limits := middleware.GetPlanLimits(c)
	var count int
	err := h.DB.QueryRow(
		`SELECT COUNT(*) FROM rfp_questions WHERE project_id = $1 AND organization_id = $2`,
		projectID, orgID,
	).Scan(&count)
	if err != nil {
		log.Printf("error counting questions for limit check: %v", err)
		return 0, nil // fail-open
	}
	if limits == nil || limits.MaxQuestions == nil {
		return count, nil
	}
	if count >= *limits.MaxQuestions {
		return count, fmt.Errorf("questions per RFP limit reached (%d/%d). Upgrade your plan for more questions", count, *limits.MaxQuestions)
	}
	return count, nil
}

// checkFeatureEnabled checks if a feature flag is enabled for the current plan.
func checkFeatureEnabled(featureName string, enabled bool) error {
	if !enabled {
		return fmt.Errorf("%s is not available on your current plan. Please upgrade to access this feature", featureName)
	}
	return nil
}

// recordUsageMetric increments a usage metric for the current billing period.
func (h *Handler) recordUsageMetric(orgID, metric string, count int) {
	if orgID == "" || count <= 0 {
		return
	}
	now := time.Now()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	periodEnd := periodStart.AddDate(0, 1, 0).Add(-time.Second)
	ps := periodStart.Format("2006-01-02")
	pe := periodEnd.Format("2006-01-02")

	_, err := h.DB.Exec(
		`INSERT INTO usage_records (organization_id, metric, count, period_start, period_end)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (organization_id, metric, period_start)
		 DO UPDATE SET count = usage_records.count + $3, updated_at = NOW()`,
		orgID, metric, count, ps, pe,
	)
	if err != nil {
		log.Printf("error recording usage metric %s for org %s: %v", metric, orgID, err)
	}
}

// recordTokenUsage records token usage, splitting between included allowance and overage.
func (h *Handler) recordTokenUsage(orgID string, tokens int) {
	if tokens <= 0 {
		return
	}
	now := time.Now()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	periodEnd := periodStart.AddDate(0, 1, 0).Add(-time.Second)
	ps := periodStart.Format("2006-01-02")
	pe := periodEnd.Format("2006-01-02")

	// Always record total usage
	_, err := h.DB.Exec(
		`INSERT INTO usage_records (organization_id, metric, count, period_start, period_end)
		 VALUES ($1, 'ai_tokens_used', $2, $3, $4)
		 ON CONFLICT (organization_id, metric, period_start)
		 DO UPDATE SET count = usage_records.count + $2, updated_at = NOW()`,
		orgID, tokens, ps, pe,
	)
	if err != nil {
		log.Printf("error recording token usage for org %s: %v", orgID, err)
	}

	// Check if any tokens are overage
	var currentUsed int64
	var maxTokens *int64
	err = h.DB.QueryRow(
		`SELECT COALESCE(ur.count, 0), pl.max_tokens_per_month
		 FROM subscriptions s
		 JOIN plan_limits pl ON pl.plan = s.plan
		 LEFT JOIN usage_records ur ON ur.organization_id = s.organization_id
		   AND ur.metric = 'ai_tokens_used' AND ur.period_start = $2
		 WHERE s.organization_id = $1 AND s.status IN ('active', 'trialing')`,
		orgID, ps,
	).Scan(&currentUsed, &maxTokens)
	if err != nil || maxTokens == nil {
		return // unlimited or no subscription
	}

	// Calculate overage: how many tokens exceed the allowance
	overageTokens := currentUsed - *maxTokens
	if overageTokens <= 0 {
		return
	}

	// Cap overage to just the tokens from this call that went over
	if int64(tokens) < overageTokens {
		overageTokens = int64(tokens)
	}

	_, err = h.DB.Exec(
		`INSERT INTO usage_records (organization_id, metric, count, period_start, period_end)
		 VALUES ($1, 'ai_tokens_overage', $2, $3, $4)
		 ON CONFLICT (organization_id, metric, period_start)
		 DO UPDATE SET count = usage_records.count + $2, updated_at = NOW()`,
		orgID, overageTokens, ps, pe,
	)
	if err != nil {
		log.Printf("error recording overage tokens for org %s: %v", orgID, err)
	}

	// Report overage to Stripe metered billing (non-blocking)
	if stripeClient != nil {
		go func(oID string, overageUnits int64) {
			// Look up the metered subscription item ID (si_xxx)
			var subItemID *string
			_ = h.DB.QueryRow(
				`SELECT stripe_subscription_item_id FROM subscriptions
				 WHERE organization_id = $1 AND status IN ('active', 'trialing')
				 AND stripe_subscription_item_id IS NOT NULL`,
				oID,
			).Scan(&subItemID)
			if subItemID == nil {
				return
			}
			// Report in units of 1K tokens
			units := (overageUnits + 999) / 1000
			if units <= 0 {
				return
			}
			if err := stripeClient.ReportMeteredUsage(*subItemID, units); err != nil {
				log.Printf("error reporting metered usage to Stripe for org %s: %v", oID, err)
			}
		}(orgID, overageTokens)
	}
}

// checkTokenLimit checks the org's token usage against their plan.
// - Free plan (no overage rate): hard block when limit reached.
// - Paid plans: always allowed (overage billed separately).
// - No subscription: fail-open.
func (h *Handler) checkTokenLimit(orgID string) error {
	now := time.Now()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)

	var usedTokens int64
	var maxTokens *int64
	var overageRate *int

	err := h.DB.QueryRow(
		`SELECT COALESCE(ur.count, 0), pl.max_tokens_per_month, pl.overage_rate_cents_per_1k
		 FROM subscriptions s
		 JOIN plan_limits pl ON pl.plan = s.plan
		 LEFT JOIN usage_records ur ON ur.organization_id = s.organization_id
		   AND ur.metric = 'ai_tokens_used' AND ur.period_start = $2
		 WHERE s.organization_id = $1 AND s.status IN ('active', 'trialing')`,
		orgID, periodStart.Format("2006-01-02"),
	).Scan(&usedTokens, &maxTokens, &overageRate)

	if err == sql.ErrNoRows {
		return nil // no subscription — fail-open
	}
	if err != nil {
		log.Printf("error checking token limit for org %s: %v", orgID, err)
		return nil // fail-open
	}

	// Unlimited plan
	if maxTokens == nil {
		return nil
	}

	// Within allowance — always OK
	if usedTokens < *maxTokens {
		return nil
	}

	// Over allowance — check if overage is allowed
	if overageRate != nil {
		// Paid plan with overage billing — allow, overage tracked in recordTokenUsage
		return nil
	}

	// Free plan — hard block
	return fmt.Errorf("monthly AI token limit reached (%d / %d). Upgrade your plan to continue", usedTokens, *maxTokens)
}
