package middleware

import (
	"database/sql"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
)

// PlanLimits holds cached plan limits from the plan_limits table.
type PlanLimits struct {
	MaxRFPs      *int `json:"max_rfps_per_month,omitempty"`
	MaxDocuments *int `json:"max_documents,omitempty"`
	MaxUsers     *int `json:"max_users,omitempty"`
	MaxQuestions *int `json:"max_questions_per_rfp,omitempty"`
	AIReview     bool `json:"ai_review_enabled"`
	Compliance   bool `json:"compliance_enabled"`
	Templates    bool `json:"template_library"`
	Analytics    bool `json:"analytics_enabled"`
}

// ContextKeyPlanLimits is the context key for storing plan limits.
const ContextKeyPlanLimits = "plan_limits"

// planCache caches plan limits to avoid DB queries on every request.
var planCache struct {
	mu        sync.RWMutex
	data      map[string]*PlanLimits
	fetchedAt time.Time
}

// CheckPlanLimits returns middleware that enforces plan-based access control.
// GET/OPTIONS requests pass through freely. Mutating requests (POST/PUT/DELETE)
// require a paid plan. Plan limits are cached for 5 minutes.
func CheckPlanLimits(db *sql.DB) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Always allow preflight and read-only requests
			method := c.Request().Method
			if method == http.MethodOptions || method == http.MethodGet {
				// Still load limits into context for GET requests so handlers can read them
				plan := GetPlan(c)
				if plan != "" && plan != "free_org" {
					if limits := getPlanLimits(db, plan); limits != nil {
						c.Set(ContextKeyPlanLimits, limits)
					}
				}
				return next(c)
			}

			plan := GetPlan(c)
			if plan == "" || plan == "free_org" {
				// No paid plan — block mutating operations
				return c.JSON(http.StatusPaymentRequired, map[string]string{
					"error":   "subscription_required",
					"message": "Please subscribe to a plan to perform this action.",
				})
			}

			// Get plan limits (cached)
			limits := getPlanLimits(db, plan)
			if limits != nil {
				c.Set(ContextKeyPlanLimits, limits)
			}

			return next(c)
		}
	}
}

// getPlanLimits returns cached plan limits, refreshing from the DB every 5 minutes.
func getPlanLimits(db *sql.DB, plan string) *PlanLimits {
	// Check cache (refresh every 5 minutes)
	planCache.mu.RLock()
	if planCache.data != nil && time.Since(planCache.fetchedAt) < 5*time.Minute {
		if l, ok := planCache.data[plan]; ok {
			planCache.mu.RUnlock()
			return l
		}
	}
	planCache.mu.RUnlock()

	// Fetch from DB
	planCache.mu.Lock()
	defer planCache.mu.Unlock()

	// Double-check after acquiring write lock
	if planCache.data != nil && time.Since(planCache.fetchedAt) < 5*time.Minute {
		if l, ok := planCache.data[plan]; ok {
			return l
		}
	}

	if planCache.data == nil {
		planCache.data = make(map[string]*PlanLimits)
	}

	var l PlanLimits
	err := db.QueryRow(
		`SELECT max_rfps_per_month, max_documents, max_users, max_questions_per_rfp,
		        ai_review_enabled, compliance_enabled, template_library, analytics_enabled
		 FROM plan_limits WHERE plan = $1`, plan,
	).Scan(&l.MaxRFPs, &l.MaxDocuments, &l.MaxUsers, &l.MaxQuestions,
		&l.AIReview, &l.Compliance, &l.Templates, &l.Analytics)

	if err != nil {
		if err != sql.ErrNoRows {
			log.Printf("warning: failed to fetch plan limits for %q: %v", plan, err)
		}
		return nil
	}

	planCache.data[plan] = &l
	planCache.fetchedAt = time.Now()
	return &l
}

// GetPlanLimits extracts plan limits from the Echo context (set by CheckPlanLimits middleware).
func GetPlanLimits(c echo.Context) *PlanLimits {
	if v, ok := c.Get(ContextKeyPlanLimits).(*PlanLimits); ok {
		return v
	}
	return nil
}
