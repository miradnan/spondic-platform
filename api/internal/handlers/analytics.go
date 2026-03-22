package handlers

import (
	"log"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/spondic/api/internal/models"
)

// AnalyticsOverview handles GET /api/analytics/overview
func (h *Handler) AnalyticsOverview(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	var overview models.AnalyticsOverview

	// Total projects
	err := h.DB.QueryRow(
		`SELECT COUNT(*) FROM projects WHERE organization_id = $1 AND deleted_at IS NULL`,
		orgID,
	).Scan(&overview.TotalProjects)
	if err != nil {
		log.Printf("error fetching project count: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Total RFPs processed (projects that have moved beyond draft)
	err = h.DB.QueryRow(
		`SELECT COUNT(*) FROM projects
		 WHERE organization_id = $1 AND deleted_at IS NULL AND status != 'draft'`,
		orgID,
	).Scan(&overview.TotalRFPsProcessed)
	if err != nil {
		log.Printf("error fetching rfps processed count: %v", err)
	}

	// Total KB documents
	err = h.DB.QueryRow(
		`SELECT COUNT(*) FROM documents WHERE organization_id = $1 AND deleted_at IS NULL`,
		orgID,
	).Scan(&overview.TotalDocuments)
	if err != nil {
		log.Printf("error fetching document count: %v", err)
	}

	// Total questions drafted (questions that have answers)
	err = h.DB.QueryRow(
		`SELECT COUNT(DISTINCT a.question_id)
		 FROM rfp_answers a
		 WHERE a.organization_id = $1`,
		orgID,
	).Scan(&overview.TotalQuestionsDrafted)
	if err != nil {
		log.Printf("error fetching questions drafted count: %v", err)
	}

	// Average confidence score
	var avgConfidence *float64
	err = h.DB.QueryRow(
		`SELECT AVG(a.confidence_score)
		 FROM rfp_answers a
		 WHERE a.organization_id = $1 AND a.confidence_score IS NOT NULL`,
		orgID,
	).Scan(&avgConfidence)
	if err != nil {
		log.Printf("error fetching avg confidence: %v", err)
	}
	if avgConfidence != nil {
		overview.AvgConfidenceScore = *avgConfidence
	}

	return c.JSON(http.StatusOK, overview)
}
