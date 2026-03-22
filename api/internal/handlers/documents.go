package handlers

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"github.com/spondic/api/internal/models"
)

// UploadDocuments handles POST /api/documents
func (h *Handler) UploadDocuments(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	form, err := c.MultipartForm()
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid multipart form"})
	}

	title := strings.TrimSpace(c.FormValue("title"))
	description := strings.TrimSpace(c.FormValue("description"))
	sourceType := strings.TrimSpace(c.FormValue("source_type"))

	uploadedFiles := form.File["files"]
	if len(uploadedFiles) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "at least one file is required"})
	}

	if h.S3 == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "S3 not configured"})
	}

	documents := make([]models.Document, 0, len(uploadedFiles))
	ctx := c.Request().Context()

	for _, fh := range uploadedFiles {
		docID := uuid.New().String()
		ext := strings.ToLower(filepath.Ext(fh.Filename))
		if ext == "" {
			ext = ".bin"
		}
		s3Key := orgID + "/documents/" + docID + ext

		file, err := fh.Open()
		if err != nil {
			log.Printf("error opening uploaded file: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to process uploaded file"})
		}

		if err := h.S3.Upload(ctx, s3Key, file, fh.Header.Get("Content-Type")); err != nil {
			file.Close()
			log.Printf("error uploading to S3: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to upload file"})
		}
		file.Close()

		docTitle := title
		if docTitle == "" {
			docTitle = fh.Filename
		}

		var doc models.Document
		err = h.DB.QueryRow(
			`INSERT INTO documents (id, organization_id, uploaded_by_user_id, title, description, source_type, file_name, file_size_bytes, status)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'processing')
			 RETURNING id, organization_id, uploaded_by_user_id, title, description, source_type, file_name, file_size_bytes, status, version, created_at, updated_at`,
			docID, orgID, userID, docTitle, nullStr(description), nullStr(sourceType), fh.Filename, fh.Size,
		).Scan(
			&doc.ID, &doc.OrganizationID, &doc.UploadedByUserID,
			&doc.Title, &doc.Description, &doc.SourceType,
			&doc.FileName, &doc.FileSizeBytes, &doc.Status, &doc.Version,
			&doc.CreatedAt, &doc.UpdatedAt,
		)
		if err != nil {
			log.Printf("error inserting document: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		}

		documents = append(documents, doc)

		// Trigger AI indexing asynchronously
		go func(oID, dID, key string) {
			aiCtx := context.Background()
			resp, err := h.AI.IndexDocument(aiCtx, oID, dID, key)
			if err != nil {
				log.Printf("AI indexing error for document %s: %v", dID, err)
				h.DB.Exec(`UPDATE documents SET status = 'failed', updated_at = NOW() WHERE id = $1 AND organization_id = $2`, dID, oID)
				return
			}
			if resp.Error != "" {
				log.Printf("AI indexing returned error for document %s: %s", dID, resp.Error)
				h.DB.Exec(`UPDATE documents SET status = 'failed', updated_at = NOW() WHERE id = $1 AND organization_id = $2`, dID, oID)
				return
			}
			h.DB.Exec(`UPDATE documents SET status = 'indexed', updated_at = NOW() WHERE id = $1 AND organization_id = $2`, dID, oID)
		}(orgID, docID, s3Key)
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"documents": documents,
	})
}

// ListDocuments handles GET /api/documents
func (h *Handler) ListDocuments(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	page, limit, offset := paginationParams(c)
	tagFilter := c.QueryParam("tag")
	statusFilter := c.QueryParam("status")

	// Build count query
	countQuery := `SELECT COUNT(DISTINCT d.id) FROM documents d`
	fetchQuery := `SELECT d.id, d.organization_id, d.uploaded_by_user_id, d.title, d.description,
	                      d.source_type, d.file_name, d.file_size_bytes, d.status, d.version,
	                      d.created_at, d.updated_at
	               FROM documents d`

	joins := ""
	where := " WHERE d.organization_id = $1 AND d.deleted_at IS NULL"
	args := []interface{}{orgID}
	argIdx := 2

	if tagFilter != "" {
		joins = " JOIN document_tags dt ON dt.document_id = d.id AND dt.organization_id = d.organization_id"
		where += " AND dt.tag_id = $" + itoa(argIdx)
		args = append(args, tagFilter)
		argIdx++
	}
	if statusFilter != "" {
		where += " AND d.status = $" + itoa(argIdx)
		args = append(args, statusFilter)
		argIdx++
	}

	var total int64
	if err := h.DB.QueryRow(countQuery+joins+where, args...).Scan(&total); err != nil {
		log.Printf("error counting documents: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	fetchArgs := make([]interface{}, len(args))
	copy(fetchArgs, args)
	fullQuery := fetchQuery + joins + where + " ORDER BY d.created_at DESC LIMIT $" + itoa(argIdx) + " OFFSET $" + itoa(argIdx+1)
	fetchArgs = append(fetchArgs, limit, offset)

	rows, err := h.DB.Query(fullQuery, fetchArgs...)
	if err != nil {
		log.Printf("error listing documents: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	docs := make([]models.Document, 0)
	for rows.Next() {
		var d models.Document
		if err := rows.Scan(
			&d.ID, &d.OrganizationID, &d.UploadedByUserID, &d.Title, &d.Description,
			&d.SourceType, &d.FileName, &d.FileSizeBytes, &d.Status, &d.Version,
			&d.CreatedAt, &d.UpdatedAt,
		); err != nil {
			log.Printf("error scanning document: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		}
		docs = append(docs, d)
	}

	return c.JSON(http.StatusOK, models.PaginatedResponse{
		Data: docs,
		Pagination: models.Pagination{
			Page:       page,
			Limit:      limit,
			Total:      total,
			TotalPages: totalPages(total, limit),
		},
	})
}

// GetDocument handles GET /api/documents/:id
func (h *Handler) GetDocument(c echo.Context) error {
	orgID := getOrgID(c)
	docID := c.Param("id")

	var d models.Document
	err := h.DB.QueryRow(
		`SELECT id, organization_id, uploaded_by_user_id, title, description, source_type,
		        file_name, file_size_bytes, content_hash, status, version, created_at, updated_at
		 FROM documents
		 WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
		docID, orgID,
	).Scan(
		&d.ID, &d.OrganizationID, &d.UploadedByUserID, &d.Title, &d.Description, &d.SourceType,
		&d.FileName, &d.FileSizeBytes, &d.ContentHash, &d.Status, &d.Version,
		&d.CreatedAt, &d.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "document not found"})
	}
	if err != nil {
		log.Printf("error getting document: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.JSON(http.StatusOK, d)
}

// DeleteDocument handles DELETE /api/documents/:id (soft delete)
func (h *Handler) DeleteDocument(c echo.Context) error {
	orgID := getOrgID(c)
	docID := c.Param("id")

	result, err := h.DB.Exec(
		`UPDATE documents SET deleted_at = NOW(), updated_at = NOW()
		 WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
		docID, orgID,
	)
	if err != nil {
		log.Printf("error deleting document: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "document not found"})
	}

	// Delete from Weaviate asynchronously
	go func() {
		if err := h.AI.DeleteDocument(context.Background(), orgID, docID); err != nil {
			log.Printf("error deleting document %s from AI service: %v", docID, err)
		}
	}()

	return c.NoContent(http.StatusNoContent)
}

// ReindexDocument handles POST /api/documents/:id/reindex
func (h *Handler) ReindexDocument(c echo.Context) error {
	orgID := getOrgID(c)
	docID := c.Param("id")

	// Get document to find the S3 key
	var fileName string
	var status string
	err := h.DB.QueryRow(
		`SELECT file_name, status FROM documents WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
		docID, orgID,
	).Scan(&fileName, &status)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "document not found"})
	}
	if err != nil {
		log.Printf("error fetching document for reindex: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Reconstruct S3 key
	ext := strings.ToLower(filepath.Ext(fileName))
	if ext == "" {
		ext = ".bin"
	}
	s3Key := orgID + "/documents/" + docID + ext

	// Update status to processing
	h.DB.Exec(`UPDATE documents SET status = 'processing', updated_at = NOW() WHERE id = $1 AND organization_id = $2`, docID, orgID)

	// Trigger reindex asynchronously
	go func() {
		aiCtx := context.Background()
		resp, err := h.AI.IndexDocument(aiCtx, orgID, docID, s3Key)
		if err != nil || (resp != nil && resp.Error != "") {
			log.Printf("reindex error for document %s: %v", docID, err)
			h.DB.Exec(`UPDATE documents SET status = 'failed', updated_at = NOW() WHERE id = $1 AND organization_id = $2`, docID, orgID)
			return
		}
		h.DB.Exec(`UPDATE documents SET status = 'indexed', updated_at = NOW() WHERE id = $1 AND organization_id = $2`, docID, orgID)
	}()

	return c.JSON(http.StatusOK, map[string]string{"status": "reindexing"})
}

// SearchDocuments handles GET /api/documents/search?q=
func (h *Handler) SearchDocuments(c echo.Context) error {
	orgID := getOrgID(c)
	query := c.QueryParam("q")
	if query == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "query parameter 'q' is required"})
	}

	resp, err := h.AI.Search(c.Request().Context(), orgID, query, 10)
	if err != nil {
		log.Printf("error calling AI search: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "search failed"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"results": resp.Results,
	})
}

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
