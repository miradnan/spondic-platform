package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

// HealthCheck returns a simple status response.
func HealthCheck(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}
