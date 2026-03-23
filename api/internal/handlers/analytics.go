package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/spondic/api/internal/middleware"
	"github.com/spondic/api/internal/models"
)

// AnalyticsOverview handles GET /api/analytics/overview
// Admins see full org data; members see only their own projects/answers.
func (h *Handler) AnalyticsOverview(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	// Check analytics feature flag
	if limits := middleware.GetPlanLimits(c); limits != nil {
		if err := checkFeatureEnabled("Analytics", limits.Analytics); err != nil {
			return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
		}
	}

	userID := getUserID(c)
	admin := isAdmin(c)

	var overview models.AnalyticsOverview

	// Total projects
	if admin {
		err := h.DB.QueryRow(
			`SELECT COUNT(*) FROM projects WHERE organization_id = $1 AND deleted_at IS NULL`,
			orgID,
		).Scan(&overview.TotalProjects)
		if err != nil {
			log.Printf("error fetching project count: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		}
	} else {
		err := h.DB.QueryRow(
			`SELECT COUNT(*) FROM projects WHERE organization_id = $1 AND deleted_at IS NULL AND created_by = $2`,
			orgID, userID,
		).Scan(&overview.TotalProjects)
		if err != nil {
			log.Printf("error fetching project count: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		}
	}

	// Total RFPs processed
	if admin {
		h.DB.QueryRow(
			`SELECT COUNT(*) FROM projects
			 WHERE organization_id = $1 AND deleted_at IS NULL AND status != 'draft'`,
			orgID,
		).Scan(&overview.TotalRFPsProcessed)
	} else {
		h.DB.QueryRow(
			`SELECT COUNT(*) FROM projects
			 WHERE organization_id = $1 AND deleted_at IS NULL AND status != 'draft' AND created_by = $2`,
			orgID, userID,
		).Scan(&overview.TotalRFPsProcessed)
	}

	// Total KB documents (always org-wide — KB is shared)
	h.DB.QueryRow(
		`SELECT COUNT(*) FROM documents WHERE organization_id = $1 AND deleted_at IS NULL`,
		orgID,
	).Scan(&overview.TotalDocuments)

	// Total questions drafted
	if admin {
		h.DB.QueryRow(
			`SELECT COUNT(DISTINCT a.question_id)
			 FROM rfp_answers a
			 WHERE a.organization_id = $1`,
			orgID,
		).Scan(&overview.TotalQuestionsDrafted)
	} else {
		h.DB.QueryRow(
			`SELECT COUNT(DISTINCT a.question_id)
			 FROM rfp_answers a
			 JOIN rfp_questions q ON q.id = a.question_id
			 JOIN projects p ON p.id = q.project_id
			 WHERE a.organization_id = $1 AND p.created_by = $2`,
			orgID, userID,
		).Scan(&overview.TotalQuestionsDrafted)
	}

	// Average confidence score
	var avgConfidence *float64
	if admin {
		h.DB.QueryRow(
			`SELECT AVG(a.confidence_score)
			 FROM rfp_answers a
			 WHERE a.organization_id = $1 AND a.confidence_score IS NOT NULL`,
			orgID,
		).Scan(&avgConfidence)
	} else {
		h.DB.QueryRow(
			`SELECT AVG(a.confidence_score)
			 FROM rfp_answers a
			 JOIN rfp_questions q ON q.id = a.question_id
			 JOIN projects p ON p.id = q.project_id
			 WHERE a.organization_id = $1 AND a.confidence_score IS NOT NULL AND p.created_by = $2`,
			orgID, userID,
		).Scan(&avgConfidence)
	}
	if avgConfidence != nil {
		overview.AvgConfidenceScore = *avgConfidence
	}

	return c.JSON(http.StatusOK, overview)
}

// AnalyticsTimeline handles GET /api/analytics/timeline
// Admins see full org timeline; members see only their own projects.
func (h *Handler) AnalyticsTimeline(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	// Check analytics feature flag
	if limits := middleware.GetPlanLimits(c); limits != nil {
		if err := checkFeatureEnabled("Analytics", limits.Analytics); err != nil {
			return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
		}
	}

	userID := getUserID(c)
	admin := isAdmin(c)

	periodStart := c.QueryParam("period_start")
	periodEnd := c.QueryParam("period_end")

	var pStart, pEnd *string
	if periodStart != "" {
		pStart = &periodStart
	}
	if periodEnd != "" {
		pEnd = &periodEnd
	}

	var query string
	var args []interface{}

	if admin {
		query = `SELECT
			DATE_TRUNC('month', created_at)::date AS month,
			COUNT(*) AS projects_created,
			COUNT(*) FILTER (WHERE status != 'draft') AS rfps_processed,
			COUNT(DISTINCT created_by) AS active_users
		 FROM projects
		 WHERE organization_id = $1 AND deleted_at IS NULL
		   AND ($2::date IS NULL OR created_at >= $2::date)
		   AND ($3::date IS NULL OR created_at <= $3::date)
		 GROUP BY month
		 ORDER BY month`
		args = []interface{}{orgID, pStart, pEnd}
	} else {
		query = `SELECT
			DATE_TRUNC('month', created_at)::date AS month,
			COUNT(*) AS projects_created,
			COUNT(*) FILTER (WHERE status != 'draft') AS rfps_processed,
			1 AS active_users
		 FROM projects
		 WHERE organization_id = $1 AND deleted_at IS NULL AND created_by = $4
		   AND ($2::date IS NULL OR created_at >= $2::date)
		   AND ($3::date IS NULL OR created_at <= $3::date)
		 GROUP BY month
		 ORDER BY month`
		args = []interface{}{orgID, pStart, pEnd, userID}
	}

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		log.Printf("error fetching analytics timeline: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	var timeline []models.TimelinePoint
	for rows.Next() {
		var tp models.TimelinePoint
		var monthDate time.Time
		if err := rows.Scan(&monthDate, &tp.ProjectsCreated, &tp.RfpsProcessed, &tp.ActiveUsers); err != nil {
			log.Printf("error scanning timeline row: %v", err)
			continue
		}
		tp.Month = monthDate.Format("2006-01")
		timeline = append(timeline, tp)
	}

	if timeline == nil {
		timeline = []models.TimelinePoint{}
	}

	return c.JSON(http.StatusOK, timeline)
}

// AnalyticsUserPerformance handles GET /api/analytics/user-performance
// Admins see all users; members see only their own performance.
func (h *Handler) AnalyticsUserPerformance(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	// Check analytics feature flag
	if limits := middleware.GetPlanLimits(c); limits != nil {
		if err := checkFeatureEnabled("Analytics", limits.Analytics); err != nil {
			return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
		}
	}

	userID := getUserID(c)
	admin := isAdmin(c)

	periodStart := c.QueryParam("period_start")
	periodEnd := c.QueryParam("period_end")

	var pStart, pEnd *string
	if periodStart != "" {
		pStart = &periodStart
	}
	if periodEnd != "" {
		pEnd = &periodEnd
	}

	var query string
	var args []interface{}

	baseQuery := `SELECT
			p.created_by AS user_id,
			COUNT(*) AS projects_created,
			COUNT(*) FILTER (WHERE p.status = 'completed' OR p.status = 'submitted') AS projects_completed,
			(SELECT COUNT(DISTINCT a.question_id)
			 FROM rfp_answers a
			 JOIN rfp_questions q ON q.id = a.question_id
			 JOIN projects p2 ON p2.id = q.project_id
			 WHERE p2.created_by = p.created_by AND a.organization_id = $1) AS questions_answered,
			COALESCE(AVG(sub.avg_conf), 0) AS avg_confidence
		 FROM projects p
		 LEFT JOIN LATERAL (
			SELECT AVG(a.confidence_score) AS avg_conf
			FROM rfp_questions q
			JOIN rfp_answers a ON a.question_id = q.id
			WHERE q.project_id = p.id AND a.confidence_score IS NOT NULL
		 ) sub ON true
		 WHERE p.organization_id = $1 AND p.deleted_at IS NULL
		   AND ($2::date IS NULL OR p.created_at >= $2::date)
		   AND ($3::date IS NULL OR p.created_at <= $3::date)`

	if admin {
		query = baseQuery + `
		 GROUP BY p.created_by
		 ORDER BY projects_created DESC`
		args = []interface{}{orgID, pStart, pEnd}
	} else {
		query = baseQuery + `
		   AND p.created_by = $4
		 GROUP BY p.created_by
		 ORDER BY projects_created DESC`
		args = []interface{}{orgID, pStart, pEnd, userID}
	}

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		log.Printf("error fetching user performance analytics: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	var results []models.UserPerformance
	for rows.Next() {
		var up models.UserPerformance
		if err := rows.Scan(&up.UserID, &up.ProjectsCreated, &up.ProjectsCompleted, &up.QuestionsAnswered, &up.AvgConfidence); err != nil {
			log.Printf("error scanning user performance row: %v", err)
			continue
		}
		results = append(results, up)
	}

	if results == nil {
		results = []models.UserPerformance{}
	}

	return c.JSON(http.StatusOK, results)
}
