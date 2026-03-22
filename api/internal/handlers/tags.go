package handlers

import (
	"log"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/spondic/api/internal/models"
)

// CreateTag handles POST /api/tags
func (h *Handler) CreateTag(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	var body struct {
		Name string `json:"name"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if body.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "name is required"})
	}

	var tag models.Tag
	err := h.DB.QueryRow(
		`INSERT INTO tags (organization_id, name)
		 VALUES ($1, $2)
		 RETURNING id, organization_id, name, created_at`,
		orgID, body.Name,
	).Scan(&tag.ID, &tag.OrganizationID, &tag.Name, &tag.CreatedAt)
	if err != nil {
		log.Printf("error creating tag: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.JSON(http.StatusCreated, tag)
}

// ListTags handles GET /api/tags
func (h *Handler) ListTags(c echo.Context) error {
	orgID := getOrgID(c)

	rows, err := h.DB.Query(
		`SELECT t.id, t.organization_id, t.name, t.created_at,
		        COUNT(dt.document_id) AS document_count
		 FROM tags t
		 LEFT JOIN document_tags dt ON dt.tag_id = t.id AND dt.organization_id = t.organization_id
		 WHERE t.organization_id = $1
		 GROUP BY t.id
		 ORDER BY t.name`,
		orgID,
	)
	if err != nil {
		log.Printf("error listing tags: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	type tagWithCount struct {
		models.Tag
		DocumentCount int `json:"document_count"`
	}

	tags := make([]tagWithCount, 0)
	for rows.Next() {
		var t tagWithCount
		if err := rows.Scan(&t.ID, &t.OrganizationID, &t.Name, &t.CreatedAt, &t.DocumentCount); err != nil {
			log.Printf("error scanning tag: %v", err)
			continue
		}
		tags = append(tags, t)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"tags": tags,
	})
}

// DeleteTag handles DELETE /api/tags/:id
func (h *Handler) DeleteTag(c echo.Context) error {
	orgID := getOrgID(c)
	tagID := c.Param("id")

	result, err := h.DB.Exec(
		`DELETE FROM tags WHERE id = $1 AND organization_id = $2`,
		tagID, orgID,
	)
	if err != nil {
		log.Printf("error deleting tag: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	affected, _ := result.RowsAffected()
	if affected == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "tag not found"})
	}

	return c.NoContent(http.StatusNoContent)
}

// AddDocumentTag handles POST /api/documents/:id/tags
func (h *Handler) AddDocumentTag(c echo.Context) error {
	orgID := getOrgID(c)
	docID := c.Param("id")

	var body struct {
		TagID string `json:"tag_id"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if body.TagID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "tag_id is required"})
	}

	// Verify document belongs to org
	var docExists bool
	err := h.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM documents WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL)`,
		docID, orgID,
	).Scan(&docExists)
	if err != nil || !docExists {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "document not found"})
	}

	// Verify tag belongs to org
	var tagExists bool
	err = h.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM tags WHERE id = $1 AND organization_id = $2)`,
		body.TagID, orgID,
	).Scan(&tagExists)
	if err != nil || !tagExists {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "tag not found"})
	}

	_, err = h.DB.Exec(
		`INSERT INTO document_tags (organization_id, document_id, tag_id)
		 VALUES ($1, $2, $3)
		 ON CONFLICT DO NOTHING`,
		orgID, docID, body.TagID,
	)
	if err != nil {
		log.Printf("error adding document tag: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.JSON(http.StatusCreated, map[string]string{"status": "tagged"})
}

// RemoveDocumentTag handles DELETE /api/documents/:id/tags/:tagId
func (h *Handler) RemoveDocumentTag(c echo.Context) error {
	orgID := getOrgID(c)
	docID := c.Param("id")
	tagID := c.Param("tagId")

	result, err := h.DB.Exec(
		`DELETE FROM document_tags WHERE organization_id = $1 AND document_id = $2 AND tag_id = $3`,
		orgID, docID, tagID,
	)
	if err != nil {
		log.Printf("error removing document tag: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	affected, _ := result.RowsAffected()
	if affected == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "document tag not found"})
	}

	return c.NoContent(http.StatusNoContent)
}

