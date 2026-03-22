package handlers

import (
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/spondic/api/internal/models"
)

var hexColorRegex = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// GetBranding returns the branding settings for the current organization.
// GET /api/branding
func (h *Handler) GetBranding(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "missing organization"})
	}

	var b models.OrgBranding
	err := h.DB.QueryRowContext(c.Request().Context(),
		`SELECT organization_id, display_name, logo_url,
		        primary_color, secondary_color, accent_color,
		        favicon_url, custom_domain, email_from_name, email_footer_text,
		        created_at, updated_at
		   FROM org_branding
		  WHERE organization_id = $1`, orgID,
	).Scan(
		&b.OrganizationID, &b.DisplayName, &b.LogoURL,
		&b.PrimaryColor, &b.SecondaryColor, &b.AccentColor,
		&b.FaviconURL, &b.CustomDomain, &b.EmailFromName, &b.EmailFooter,
		&b.CreatedAt, &b.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		// Return empty defaults
		return c.JSON(http.StatusOK, models.OrgBranding{
			OrganizationID: orgID,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to fetch branding"})
	}

	return c.JSON(http.StatusOK, b)
}

// UpdateBranding upserts branding settings for the current organization.
// PUT /api/branding
func (h *Handler) UpdateBranding(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "missing organization"})
	}

	var req struct {
		DisplayName    *string `json:"display_name"`
		LogoURL        *string `json:"logo_url"`
		PrimaryColor   *string `json:"primary_color"`
		SecondaryColor *string `json:"secondary_color"`
		AccentColor    *string `json:"accent_color"`
		FaviconURL     *string `json:"favicon_url"`
		CustomDomain   *string `json:"custom_domain"`
		EmailFromName  *string `json:"email_from_name"`
		EmailFooter    *string `json:"email_footer_text"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	// Validate hex colors if provided
	for label, color := range map[string]*string{
		"primary_color":   req.PrimaryColor,
		"secondary_color": req.SecondaryColor,
		"accent_color":    req.AccentColor,
	} {
		if color != nil && *color != "" && !hexColorRegex.MatchString(*color) {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": fmt.Sprintf("invalid %s: must be a 7-character hex color (e.g. #2d5fa0)", label),
			})
		}
	}

	var b models.OrgBranding
	err := h.DB.QueryRowContext(c.Request().Context(),
		`INSERT INTO org_branding (
			organization_id, display_name, logo_url,
			primary_color, secondary_color, accent_color,
			favicon_url, custom_domain, email_from_name, email_footer_text,
			created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW(), NOW())
		ON CONFLICT (organization_id) DO UPDATE SET
			display_name     = COALESCE(EXCLUDED.display_name, org_branding.display_name),
			logo_url         = COALESCE(EXCLUDED.logo_url, org_branding.logo_url),
			primary_color    = COALESCE(EXCLUDED.primary_color, org_branding.primary_color),
			secondary_color  = COALESCE(EXCLUDED.secondary_color, org_branding.secondary_color),
			accent_color     = COALESCE(EXCLUDED.accent_color, org_branding.accent_color),
			favicon_url      = COALESCE(EXCLUDED.favicon_url, org_branding.favicon_url),
			custom_domain    = COALESCE(EXCLUDED.custom_domain, org_branding.custom_domain),
			email_from_name  = COALESCE(EXCLUDED.email_from_name, org_branding.email_from_name),
			email_footer_text = COALESCE(EXCLUDED.email_footer_text, org_branding.email_footer_text),
			updated_at       = NOW()
		RETURNING organization_id, display_name, logo_url,
		          primary_color, secondary_color, accent_color,
		          favicon_url, custom_domain, email_from_name, email_footer_text,
		          created_at, updated_at`,
		orgID, req.DisplayName, req.LogoURL,
		req.PrimaryColor, req.SecondaryColor, req.AccentColor,
		req.FaviconURL, req.CustomDomain, req.EmailFromName, req.EmailFooter,
	).Scan(
		&b.OrganizationID, &b.DisplayName, &b.LogoURL,
		&b.PrimaryColor, &b.SecondaryColor, &b.AccentColor,
		&b.FaviconURL, &b.CustomDomain, &b.EmailFromName, &b.EmailFooter,
		&b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to save branding"})
	}

	// Audit log
	userID := getUserID(c)
	_, _ = h.DB.ExecContext(c.Request().Context(),
		`INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, ip_address, user_agent)
		 VALUES ($1, $2, 'branding.update', 'org_branding', $1, $3, $4)`,
		orgID, userID, c.RealIP(), c.Request().UserAgent(),
	)

	return c.JSON(http.StatusOK, b)
}

// UploadBrandingLogo handles logo file upload for org branding.
// POST /api/branding/logo
func (h *Handler) UploadBrandingLogo(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "missing organization"})
	}

	if h.S3 == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "file uploads are not configured"})
	}

	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing file in request"})
	}

	// Validate size: max 2 MB
	if file.Size > 2*1024*1024 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file too large (max 2MB)"})
	}

	// Validate file type
	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowedExts := map[string]string{
		".png":  "image/png",
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".svg":  "image/svg+xml",
	}
	contentType, ok := allowedExts[ext]
	if !ok {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid file type: must be PNG, JPG, or SVG"})
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to read uploaded file"})
	}
	defer src.Close()

	// Upload to S3 at {org_id}/branding/logo.{ext}
	s3Key := fmt.Sprintf("%s/branding/logo%s", orgID, ext)
	if uploadErr := h.S3.Upload(c.Request().Context(), s3Key, io.Reader(src), contentType); uploadErr != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to upload logo"})
	}

	logoURL := fmt.Sprintf("https://%s.s3.amazonaws.com/%s", h.S3Bucket, s3Key)

	// Upsert branding row with the new logo URL
	_, err = h.DB.ExecContext(c.Request().Context(),
		`INSERT INTO org_branding (organization_id, logo_url, created_at, updated_at)
		 VALUES ($1, $2, NOW(), NOW())
		 ON CONFLICT (organization_id) DO UPDATE SET
			logo_url   = $2,
			updated_at = NOW()`,
		orgID, logoURL,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to save logo URL"})
	}

	// Audit log
	userID := getUserID(c)
	_, _ = h.DB.ExecContext(c.Request().Context(),
		`INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, ip_address, user_agent)
		 VALUES ($1, $2, 'branding.logo_upload', 'org_branding', $1, $3, $4)`,
		orgID, userID, c.RealIP(), c.Request().UserAgent(),
	)

	return c.JSON(http.StatusOK, map[string]string{"logo_url": logoURL})
}
