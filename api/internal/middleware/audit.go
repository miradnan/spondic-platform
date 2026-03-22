package middleware

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
)

// AuditLogger returns middleware that logs mutating requests to the audit_logs table.
func AuditLogger(db *sql.DB) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Execute the handler first
			err := next(c)

			// Only log mutating methods
			method := c.Request().Method
			if method != http.MethodPost && method != http.MethodPut && method != http.MethodDelete {
				return err
			}

			// Only log successful mutations (2xx)
			status := c.Response().Status
			if status < 200 || status >= 300 {
				return err
			}

			userID := GetUserID(c)
			orgID := GetOrgID(c)
			if orgID == "" || userID == "" {
				return err
			}

			action := deriveAction(method, c.Path())
			entityType, entityID := deriveEntity(c)
			ipAddress := c.RealIP()
			userAgent := c.Request().UserAgent()

			metadata := map[string]interface{}{
				"method": method,
				"path":   c.Request().URL.Path,
				"status": status,
			}
			metadataJSON, _ := json.Marshal(metadata)

			go func() {
				_, dbErr := db.Exec(
					`INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
					 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
					orgID, userID, action, nullableString(entityType), nullableString(entityID),
					string(metadataJSON), ipAddress, userAgent,
				)
				if dbErr != nil {
					log.Printf("audit log insert error: %v", dbErr)
				}
			}()

			return err
		}
	}
}

func deriveAction(method, path string) string {
	switch method {
	case http.MethodPost:
		if strings.Contains(path, "/approve") {
			return "approve"
		}
		if strings.Contains(path, "/comment") {
			return "comment"
		}
		if strings.Contains(path, "/parse") {
			return "parse"
		}
		if strings.Contains(path, "/draft") {
			return "draft"
		}
		if strings.Contains(path, "/redraft") {
			return "redraft"
		}
		if strings.Contains(path, "/reindex") {
			return "reindex"
		}
		if strings.Contains(path, "/export") {
			return "export"
		}
		if strings.Contains(path, "/messages") {
			return "send_message"
		}
		if strings.Contains(path, "/tags") {
			return "tag"
		}
		return "create"
	case http.MethodPut:
		return "update"
	case http.MethodDelete:
		return "delete"
	default:
		return method
	}
}

func deriveEntity(c echo.Context) (string, string) {
	path := c.Path()

	switch {
	case strings.Contains(path, "/projects"):
		return "project", c.Param("id")
	case strings.Contains(path, "/documents"):
		return "document", c.Param("id")
	case strings.Contains(path, "/questions"):
		return "question", c.Param("qid")
	case strings.Contains(path, "/answers"):
		return "answer", c.Param("aid")
	case strings.Contains(path, "/chats"):
		return "chat", c.Param("id")
	case strings.Contains(path, "/tags"):
		return "tag", c.Param("id")
	case strings.Contains(path, "/rfp"):
		return "rfp", c.Param("id")
	default:
		return "", ""
	}
}

func nullableString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
