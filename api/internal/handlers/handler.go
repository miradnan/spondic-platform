package handlers

import (
	"database/sql"
	"math"
	"strconv"

	"github.com/labstack/echo/v4"

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
