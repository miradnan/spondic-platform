package handlers

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/spondic/api/internal/models"
	"github.com/spondic/api/internal/services"
)

// CreateChat handles POST /api/chats
func (h *Handler) CreateChat(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	var body struct {
		Title *string `json:"title"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	var chat models.Chat
	err := h.DB.QueryRow(
		`INSERT INTO chats (organization_id, user_id, title)
		 VALUES ($1, $2, $3)
		 RETURNING id, organization_id, user_id, title, created_at, updated_at`,
		orgID, userID, body.Title,
	).Scan(
		&chat.ID, &chat.OrganizationID, &chat.UserID, &chat.Title,
		&chat.CreatedAt, &chat.UpdatedAt,
	)
	if err != nil {
		log.Printf("error creating chat: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.JSON(http.StatusCreated, chat)
}

// ListChats handles GET /api/chats
func (h *Handler) ListChats(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)

	page, limit, offset := paginationParams(c)

	var total int64
	err := h.DB.QueryRow(
		`SELECT COUNT(*) FROM chats WHERE organization_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
		orgID, userID,
	).Scan(&total)
	if err != nil {
		log.Printf("error counting chats: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	rows, err := h.DB.Query(
		`SELECT id, organization_id, user_id, title, created_at, updated_at
		 FROM chats
		 WHERE organization_id = $1 AND user_id = $2 AND deleted_at IS NULL
		 ORDER BY updated_at DESC
		 LIMIT $3 OFFSET $4`,
		orgID, userID, limit, offset,
	)
	if err != nil {
		log.Printf("error listing chats: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	chats := make([]models.Chat, 0)
	for rows.Next() {
		var ch models.Chat
		if err := rows.Scan(
			&ch.ID, &ch.OrganizationID, &ch.UserID, &ch.Title,
			&ch.CreatedAt, &ch.UpdatedAt,
		); err != nil {
			log.Printf("error scanning chat: %v", err)
			continue
		}
		chats = append(chats, ch)
	}

	return c.JSON(http.StatusOK, models.PaginatedResponse{
		Data: chats,
		Pagination: models.Pagination{
			Page:       page,
			Limit:      limit,
			Total:      total,
			TotalPages: totalPages(total, limit),
		},
	})
}

// SendMessage handles POST /api/chats/:id/messages
func (h *Handler) SendMessage(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	chatID := c.Param("id")

	// Verify chat belongs to user and org
	var exists bool
	err := h.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM chats WHERE id = $1 AND organization_id = $2 AND user_id = $3 AND deleted_at IS NULL)`,
		chatID, orgID, userID,
	).Scan(&exists)
	if err != nil || !exists {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "chat not found"})
	}

	var body struct {
		Message string `json:"message"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if body.Message == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "message is required"})
	}

	// Save user message
	var userMsg models.ChatMessage
	err = h.DB.QueryRow(
		`INSERT INTO chat_messages (chat_id, role, message)
		 VALUES ($1, 'user', $2)
		 RETURNING id, chat_id, role, message, created_at`,
		chatID, body.Message,
	).Scan(&userMsg.ID, &userMsg.ChatID, &userMsg.Role, &userMsg.Message, &userMsg.CreatedAt)
	if err != nil {
		log.Printf("error saving user message: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Get chat history for context
	histRows, err := h.DB.Query(
		`SELECT role, message FROM chat_messages WHERE chat_id = $1 ORDER BY created_at LIMIT 20`,
		chatID,
	)
	if err != nil {
		log.Printf("error fetching chat history: %v", err)
	}

	var history []services.ChatTurn
	if histRows != nil {
		defer histRows.Close()
		for histRows.Next() {
			var role, msg string
			if err := histRows.Scan(&role, &msg); err == nil {
				history = append(history, services.ChatTurn{Role: role, Content: msg})
			}
		}
	}

	// Call AI service
	aiResp, err := h.AI.Chat(c.Request().Context(), orgID, body.Message, history)
	if err != nil {
		log.Printf("AI chat error: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "AI service error"})
	}

	assistantMessage := aiResp.Response
	if assistantMessage == "" {
		assistantMessage = "I'm sorry, I wasn't able to generate a response. Please try again."
	}

	// Save assistant message
	var assistantMsg models.ChatMessage
	err = h.DB.QueryRow(
		`INSERT INTO chat_messages (chat_id, role, message)
		 VALUES ($1, 'assistant', $2)
		 RETURNING id, chat_id, role, message, created_at`,
		chatID, assistantMessage,
	).Scan(&assistantMsg.ID, &assistantMsg.ChatID, &assistantMsg.Role, &assistantMsg.Message, &assistantMsg.CreatedAt)
	if err != nil {
		log.Printf("error saving assistant message: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Update chat's updated_at
	h.DB.Exec(`UPDATE chats SET updated_at = NOW() WHERE id = $1`, chatID)

	// Auto-title if first message and no title
	var title *string
	h.DB.QueryRow(`SELECT title FROM chats WHERE id = $1`, chatID).Scan(&title)
	if title == nil || *title == "" {
		truncated := body.Message
		if len(truncated) > 100 {
			truncated = truncated[:100] + "..."
		}
		h.DB.Exec(`UPDATE chats SET title = $1 WHERE id = $2`, truncated, chatID)
	}

	// Build citations for the response
	var citations []map[string]interface{}
	if aiResp.Citations != nil {
		for _, cit := range aiResp.Citations {
			citations = append(citations, map[string]interface{}{
				"document_title":  cit.DocumentTitle,
				"citation_text":   cit.CitationText,
				"relevance_score": cit.RelevanceScore,
			})
		}
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"user_message":      userMsg,
		"assistant_message": assistantMsg,
		"citations":         citations,
	})
}

// SendMessageStream handles POST /api/chats/:id/messages/stream
// It saves the user message, proxies the SSE stream from the AI service,
// and saves the complete assistant message after the stream finishes.
func (h *Handler) SendMessageStream(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	chatID := c.Param("id")

	// Verify chat belongs to user and org
	var chatOwned bool
	err := h.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM chats WHERE id = $1 AND organization_id = $2 AND user_id = $3 AND deleted_at IS NULL)`,
		chatID, orgID, userID,
	).Scan(&chatOwned)
	if err != nil || !chatOwned {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "chat not found"})
	}

	var body struct {
		Message string `json:"message"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if body.Message == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "message is required"})
	}

	// Save user message to DB
	_, err = h.DB.Exec(
		`INSERT INTO chat_messages (chat_id, role, message) VALUES ($1, 'user', $2)`,
		chatID, body.Message,
	)
	if err != nil {
		log.Printf("error saving user message (stream): %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Get chat history for context
	histRows, err := h.DB.Query(
		`SELECT role, message FROM chat_messages WHERE chat_id = $1 ORDER BY created_at LIMIT 20`,
		chatID,
	)
	if err != nil {
		log.Printf("error fetching chat history (stream): %v", err)
	}

	var history []services.ChatTurn
	if histRows != nil {
		defer histRows.Close()
		for histRows.Next() {
			var role, msg string
			if err := histRows.Scan(&role, &msg); err == nil {
				history = append(history, services.ChatTurn{Role: role, Content: msg})
			}
		}
	}

	// Call AI service streaming endpoint
	aiResp, err := h.AI.ChatStream(c.Request().Context(), orgID, body.Message, history)
	if err != nil {
		log.Printf("AI chat stream error: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "AI service error"})
	}
	defer aiResp.Body.Close()

	// Set SSE headers
	c.Response().Header().Set("Content-Type", "text/event-stream")
	c.Response().Header().Set("Cache-Control", "no-cache")
	c.Response().Header().Set("Connection", "keep-alive")
	c.Response().Header().Set("X-Accel-Buffering", "no")
	c.Response().WriteHeader(http.StatusOK)

	flusher, ok := c.Response().Writer.(http.Flusher)
	if !ok {
		return fmt.Errorf("streaming not supported")
	}

	// Proxy the SSE stream from the AI service to the client
	var fullText strings.Builder
	scanner := bufio.NewScanner(aiResp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, "data: ") {
			jsonData := line[6:]
			var event struct {
				Type    string `json:"type"`
				Content string `json:"content,omitempty"`
			}
			if err := json.Unmarshal([]byte(jsonData), &event); err == nil {
				if event.Type == "text" {
					fullText.WriteString(event.Content)
				}
			}

			// Forward the line to the client
			fmt.Fprintf(c.Response().Writer, "%s\n\n", line)
			flusher.Flush()
		}
	}

	if err := scanner.Err(); err != nil {
		log.Printf("error reading AI stream: %v", err)
	}

	// Save the complete assistant message to DB after streaming finishes
	assistantMessage := fullText.String()
	if assistantMessage == "" {
		assistantMessage = "I'm sorry, I wasn't able to generate a response. Please try again."
	}

	h.DB.Exec(
		`INSERT INTO chat_messages (chat_id, role, message) VALUES ($1, 'assistant', $2)`,
		chatID, assistantMessage,
	)

	// Update chat's updated_at
	h.DB.Exec(`UPDATE chats SET updated_at = NOW() WHERE id = $1`, chatID)

	// Auto-title if first message and no title
	var chatTitle *string
	h.DB.QueryRow(`SELECT title FROM chats WHERE id = $1`, chatID).Scan(&chatTitle)
	if chatTitle == nil || *chatTitle == "" {
		truncated := body.Message
		if len(truncated) > 100 {
			truncated = truncated[:100] + "..."
		}
		h.DB.Exec(`UPDATE chats SET title = $1 WHERE id = $2`, truncated, chatID)
	}

	return nil
}

// DeleteChat handles DELETE /api/chats/:id
func (h *Handler) DeleteChat(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	chatID := c.Param("id")

	// Verify chat belongs to user and org
	var exists bool
	err := h.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM chats WHERE id = $1 AND organization_id = $2 AND user_id = $3 AND deleted_at IS NULL)`,
		chatID, orgID, userID,
	).Scan(&exists)
	if err != nil || !exists {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "chat not found"})
	}

	// Hard delete chat messages (not useful without the chat)
	_, err = h.DB.Exec(`DELETE FROM chat_messages WHERE chat_id = $1`, chatID)
	if err != nil {
		log.Printf("error deleting chat messages: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Soft delete the chat
	_, err = h.DB.Exec(
		`UPDATE chats SET deleted_at = NOW() WHERE id = $1 AND organization_id = $2 AND user_id = $3`,
		chatID, orgID, userID,
	)
	if err != nil {
		log.Printf("error deleting chat: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.NoContent(http.StatusNoContent)
}

// GetMessages handles GET /api/chats/:id/messages
func (h *Handler) GetMessages(c echo.Context) error {
	orgID := getOrgID(c)
	userID := getUserID(c)
	chatID := c.Param("id")

	// Verify chat belongs to user and org
	var chatExists bool
	err := h.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM chats WHERE id = $1 AND organization_id = $2 AND user_id = $3 AND deleted_at IS NULL)`,
		chatID, orgID, userID,
	).Scan(&chatExists)
	if err != nil || !chatExists {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "chat not found"})
	}

	page, limit, offset := paginationParams(c)

	var total int64
	h.DB.QueryRow(`SELECT COUNT(*) FROM chat_messages WHERE chat_id = $1`, chatID).Scan(&total)

	rows, err := h.DB.Query(
		`SELECT id, chat_id, role, message, created_at
		 FROM chat_messages
		 WHERE chat_id = $1
		 ORDER BY created_at
		 LIMIT $2 OFFSET $3`,
		chatID, limit, offset,
	)
	if err != nil {
		log.Printf("error listing messages: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	messages := make([]models.ChatMessage, 0)
	for rows.Next() {
		var m models.ChatMessage
		if err := rows.Scan(&m.ID, &m.ChatID, &m.Role, &m.Message, &m.CreatedAt); err != nil {
			log.Printf("error scanning message: %v", err)
			continue
		}
		messages = append(messages, m)
	}

	return c.JSON(http.StatusOK, models.PaginatedResponse{
		Data: messages,
		Pagination: models.Pagination{
			Page:       page,
			Limit:      limit,
			Total:      total,
			TotalPages: totalPages(total, limit),
		},
	})
}
