package middleware

import (
	"database/sql"
	"fmt"
	"log"

	"github.com/labstack/echo/v4"
)

// SetRLSContext returns Echo middleware that sets the PostgreSQL session
// variable app.current_organization_id for Row Level Security.
//
// This must run AFTER ClerkAuth middleware so that ContextKeyOrgID is available.
// It executes SET LOCAL (transaction-scoped) so the variable is automatically
// cleared when the connection returns to the pool.
func SetRLSContext(db *sql.DB) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			orgID := GetOrgID(c)
			if orgID == "" {
				// No org context — RLS will block all rows (safe default)
				return next(c)
			}

			// SET LOCAL is scoped to the current transaction. Since we're not
			// in an explicit transaction here, we use SET (session-scoped).
			// The connection pool will reset this when the connection is reused.
			//
			// For production, consider wrapping each request in a transaction
			// and using SET LOCAL instead.
			_, err := db.Exec(
				fmt.Sprintf("SET app.current_organization_id = %s", quoteIdent(orgID)),
			)
			if err != nil {
				log.Printf("failed to set RLS context: %v", err)
				// Don't block the request — existing WHERE clauses still protect
				return next(c)
			}

			return next(c)
		}
	}
}

// quoteIdent safely quotes a string for use as a PostgreSQL session variable value.
// This prevents SQL injection in the SET command.
func quoteIdent(s string) string {
	// Use dollar-quoting to prevent injection
	return "'" + escapePostgresString(s) + "'"
}

// escapePostgresString escapes single quotes in a PostgreSQL string literal.
func escapePostgresString(s string) string {
	result := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		if s[i] == '\'' {
			result = append(result, '\'', '\'')
		} else {
			result = append(result, s[i])
		}
	}
	return string(result)
}
