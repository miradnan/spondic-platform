package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/lib/pq"

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
		go func(oID, uID, dID, key string) {
			aiCtx := context.Background()
			resp, err := h.AI.IndexDocument(aiCtx, oID, dID, key)
			if err != nil {
				log.Printf("AI indexing error for document %s: %v", dID, err)
				h.DB.Exec(`UPDATE documents SET status = 'failed', updated_at = NOW() WHERE id = $1 AND organization_id = $2`, dID, oID)
				if h.Events != nil {
					h.Events.PublishToUser(h.DB, oID, uID, "document.status", map[string]string{"document_id": dID, "status": "failed"})
				}
				return
			}
			if resp.Error != "" {
				log.Printf("AI indexing returned error for document %s: %s", dID, resp.Error)
				h.DB.Exec(`UPDATE documents SET status = 'failed', updated_at = NOW() WHERE id = $1 AND organization_id = $2`, dID, oID)
				if h.Events != nil {
					h.Events.PublishToUser(h.DB, oID, uID, "document.status", map[string]string{"document_id": dID, "status": "failed"})
				}
				return
			}
			h.DB.Exec(`UPDATE documents SET status = 'indexed', updated_at = NOW() WHERE id = $1 AND organization_id = $2`, dID, oID)
			if h.Events != nil {
				h.Events.PublishToUser(h.DB, oID, uID, "document.status", map[string]string{"document_id": dID, "status": "indexed"})
			}
			if h.Notifier != nil {
				var docTitle string
				_ = h.DB.QueryRow(`SELECT title FROM documents WHERE id = $1 AND organization_id = $2`, dID, oID).Scan(&docTitle)
				if docTitle == "" {
					docTitle = "Document"
				}
				_ = h.Notifier.Create(oID, uID, "document_indexed", "Document Indexed: "+docTitle, docTitle+" has been indexed and is ready for use.", "document", dID)
				if h.Events != nil {
					h.Events.PublishToUser(h.DB, oID, uID, "notification.new", map[string]string{"type": "document_indexed"})
				}
			}
		}(orgID, userID, docID, s3Key)
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
	where := " WHERE d.organization_id = $1 AND d.deleted_at IS NULL AND COALESCE(d.source_type, '') != 'rfp'"
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
	docIDs := make([]string, 0)
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
		d.Tags = []models.Tag{} // initialize to empty slice (not null in JSON)
		docs = append(docs, d)
		docIDs = append(docIDs, d.ID)
	}

	// Batch-fetch tags for all documents
	if len(docIDs) > 0 {
		tagRows, tagErr := h.DB.Query(
			`SELECT dt.document_id, t.id, t.organization_id, t.name, t.created_at
			 FROM document_tags dt
			 JOIN tags t ON t.id = dt.tag_id
			 WHERE dt.organization_id = $1 AND dt.document_id = ANY($2)`,
			orgID, pq.Array(docIDs),
		)
		if tagErr == nil {
			defer tagRows.Close()
			tagMap := make(map[string][]models.Tag)
			for tagRows.Next() {
				var docID string
				var t models.Tag
				if tagRows.Scan(&docID, &t.ID, &t.OrganizationID, &t.Name, &t.CreatedAt) == nil {
					tagMap[docID] = append(tagMap[docID], t)
				}
			}
			for i := range docs {
				if tags, ok := tagMap[docs[i].ID]; ok {
					docs[i].Tags = tags
				}
			}
		}
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

// DocumentPreviewURL handles GET /api/documents/:id/preview-url
// Returns a presigned S3 URL valid for 5 minutes.
func (h *Handler) DocumentPreviewURL(c echo.Context) error {
	orgID := getOrgID(c)
	docID := c.Param("id")

	var fileName sql.NullString
	var status string
	err := h.DB.QueryRow(
		`SELECT file_name, status FROM documents
		 WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
		docID, orgID,
	).Scan(&fileName, &status)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "document not found"})
	}
	if err != nil {
		log.Printf("error getting document for preview: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	if h.S3 == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "file storage not configured"})
	}

	// Reconstruct S3 key: {org_id}/documents/{doc_id}{ext}
	ext := ".bin"
	if fileName.Valid && fileName.String != "" {
		e := strings.ToLower(filepath.Ext(fileName.String))
		if e != "" {
			ext = e
		}
	}
	s3Key := orgID + "/documents/" + docID + ext

	url, err := h.S3.PresignedURL(c.Request().Context(), s3Key, 5*time.Minute)
	if err != nil {
		log.Printf("error generating presigned URL: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to generate preview URL"})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"url":       url,
		"file_name": fileName.String,
		"ext":       ext,
	})
}

// DeleteDocument handles DELETE /api/documents/:id (soft delete, admin only)
func (h *Handler) DeleteDocument(c echo.Context) error {
	if !isAdmin(c) {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "only admins can delete documents"})
	}
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
	userID := getUserID(c)
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
			if h.Events != nil {
				h.Events.PublishToUser(h.DB, orgID, userID, "document.status", map[string]string{"document_id": docID, "status": "failed"})
			}
			return
		}
		h.DB.Exec(`UPDATE documents SET status = 'indexed', updated_at = NOW() WHERE id = $1 AND organization_id = $2`, docID, orgID)
		if h.Events != nil {
			h.Events.PublishToUser(h.DB, orgID, userID, "document.status", map[string]string{"document_id": docID, "status": "indexed"})
		}
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

// DocumentEvents handles GET /api/documents/events (SSE)
// Delivers scoped events: user-level (upload status), team-level, and org-level.
func (h *Handler) DocumentEvents(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	// Look up user's team memberships for team-scoped events
	var teamIDs []string
	rows, err := h.DB.Query(`SELECT team_id FROM team_members WHERE user_id = $1`, userID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var tid string
			if rows.Scan(&tid) == nil {
				teamIDs = append(teamIDs, tid)
			}
		}
	}

	c.Response().Header().Set("Content-Type", "text/event-stream")
	c.Response().Header().Set("Cache-Control", "no-cache")
	c.Response().Header().Set("Connection", "keep-alive")
	c.Response().Header().Set("X-Accel-Buffering", "no")
	c.Response().WriteHeader(http.StatusOK)

	flusher, ok := c.Response().Writer.(http.Flusher)
	if !ok {
		return fmt.Errorf("streaming not supported")
	}

	sub := h.Events.Subscribe(orgID, userID, teamIDs)
	defer h.Events.Unsubscribe(orgID, sub)

	ctx := c.Request().Context()
	for {
		select {
		case <-ctx.Done():
			return nil
		case evt, ok := <-sub.Ch:
			if !ok {
				return nil
			}
			payload, _ := json.Marshal(evt)
			fmt.Fprintf(c.Response().Writer, "data: %s\n\n", payload)
			flusher.Flush()
		}
	}
}

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
