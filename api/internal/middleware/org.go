package middleware

import (
	"database/sql"
	"log"
	"net/http"

	"github.com/labstack/echo/v4"
)

// EnsureOrg is middleware that auto-creates the organization row in Postgres
// if it doesn't already exist. This runs after ClerkAuth (which sets org_id
// in the context) and before any handler, so handlers never hit FK violations.
func EnsureOrg(db *sql.DB) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if c.Request().Method == http.MethodOptions {
				return next(c)
			}

			orgID := GetOrgID(c)
			if orgID == "" {
				return next(c)
			}

			_, err := db.Exec(
				`INSERT INTO organizations (clerk_org_id) VALUES ($1) ON CONFLICT (clerk_org_id) DO NOTHING`,
				orgID,
			)
			if err != nil {
				log.Printf("warning: failed to ensure org %s: %v", orgID, err)
				// Don't block the request — the handler may still work
			}

			return next(c)
		}
	}
}
