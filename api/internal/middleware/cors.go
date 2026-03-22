package middleware

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
)

// CORS returns configured CORS middleware.
// origins is a comma-separated list of allowed origins.
func CORS(origins string) echo.MiddlewareFunc {
	allowedOrigins := strings.Split(origins, ",")
	for i := range allowedOrigins {
		allowedOrigins[i] = strings.TrimSpace(allowedOrigins[i])
	}

	return echomw.CORSWithConfig(echomw.CORSConfig{
		AllowOrigins: allowedOrigins,
		AllowMethods: []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodDelete,
			http.MethodOptions,
		},
		AllowHeaders: []string{
			"Content-Type",
			"Authorization",
			"X-Requested-With",
		},
		AllowCredentials: true,
		MaxAge:           86400,
	})
}
