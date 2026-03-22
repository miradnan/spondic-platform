package middleware

import (
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

// contextKey constants for storing auth info in the Echo context.
const (
	ContextKeyUserID = "user_id"
	ContextKeyOrgID  = "organization_id"
	ContextKeyPlan   = "plan"
)

// jwksCache caches the JWKS keys for Clerk JWT verification.
type jwksCache struct {
	mu        sync.RWMutex
	keys      map[string]*rsa.PublicKey
	fetchedAt time.Time
	jwksURL   string
	ttl       time.Duration
}

// jwksResponse represents the JSON Web Key Set response.
type jwksResponse struct {
	Keys []jwkKey `json:"keys"`
}

type jwkKey struct {
	KTY string `json:"kty"`
	KID string `json:"kid"`
	Use string `json:"use"`
	N   string `json:"n"`
	E   string `json:"e"`
	ALG string `json:"alg"`
}

func newJWKSCache(jwksURL string) *jwksCache {
	return &jwksCache{
		keys:    make(map[string]*rsa.PublicKey),
		jwksURL: jwksURL,
		ttl:     1 * time.Hour,
	}
}

func (c *jwksCache) getKey(kid string) (*rsa.PublicKey, error) {
	c.mu.RLock()
	if time.Since(c.fetchedAt) < c.ttl {
		if key, ok := c.keys[kid]; ok {
			c.mu.RUnlock()
			return key, nil
		}
	}
	c.mu.RUnlock()

	// Refresh keys
	if err := c.refresh(); err != nil {
		return nil, err
	}

	c.mu.RLock()
	defer c.mu.RUnlock()
	key, ok := c.keys[kid]
	if !ok {
		return nil, fmt.Errorf("key %s not found in JWKS", kid)
	}
	return key, nil
}

func (c *jwksCache) refresh() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Double-check after acquiring write lock
	if time.Since(c.fetchedAt) < 10*time.Second {
		return nil
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(c.jwksURL)
	if err != nil {
		return fmt.Errorf("failed to fetch JWKS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("JWKS endpoint returned status %d", resp.StatusCode)
	}

	var jwks jwksResponse
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return fmt.Errorf("failed to decode JWKS: %w", err)
	}

	keys := make(map[string]*rsa.PublicKey)
	for _, k := range jwks.Keys {
		if k.KTY != "RSA" {
			continue
		}
		pub, err := parseRSAPublicKey(k.N, k.E)
		if err != nil {
			continue
		}
		keys[k.KID] = pub
	}

	c.keys = keys
	c.fetchedAt = time.Now()
	return nil
}

func parseRSAPublicKey(nStr, eStr string) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(nStr)
	if err != nil {
		return nil, err
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(eStr)
	if err != nil {
		return nil, err
	}

	n := new(big.Int).SetBytes(nBytes)
	e := new(big.Int).SetBytes(eBytes)

	return &rsa.PublicKey{
		N: n,
		E: int(e.Int64()),
	}, nil
}

// ClerkAuth returns Echo middleware that validates Clerk JWTs.
// If jwksURL is empty, it falls back to requiring a non-empty Bearer token
// (useful for local development without Clerk).
func ClerkAuth(jwksURL string) echo.MiddlewareFunc {
	var cache *jwksCache
	if jwksURL != "" {
		cache = newJWKSCache(jwksURL)
	}

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Skip auth for CORS preflight requests
			if c.Request().Method == http.MethodOptions {
				return next(c)
			}

			auth := c.Request().Header.Get("Authorization")
			if auth == "" || len(auth) < 8 || !strings.HasPrefix(auth, "Bearer ") {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "missing or invalid authorization"})
			}
			tokenStr := auth[7:]

			if cache == nil {
				// Dev fallback: parse JWT without verification to extract claims
				parser := jwt.NewParser(jwt.WithoutClaimsValidation())
				token, _, err := parser.ParseUnverified(tokenStr, jwt.MapClaims{})
				if err != nil {
					return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid token"})
				}
				claims, ok := token.Claims.(jwt.MapClaims)
				if !ok {
					return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid token claims"})
				}
				setClaimsOnContext(c, claims)
				return next(c)
			}

			// Production: verify JWT against Clerk JWKS
			token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				}
				kid, ok := token.Header["kid"].(string)
				if !ok {
					return nil, fmt.Errorf("missing kid in token header")
				}
				return cache.getKey(kid)
			})
			if err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid or expired token"})
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok || !token.Valid {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid token claims"})
			}

			setClaimsOnContext(c, claims)
			return next(c)
		}
	}
}

// ContextKeyOrgRole stores the user's role within the organization.
const ContextKeyOrgRole = "org_role"

func setClaimsOnContext(c echo.Context, claims jwt.MapClaims) {
	sub, _ := claims["sub"].(string)
	if sub != "" {
		c.Set(ContextKeyUserID, sub)
	}

	// Clerk v2 JWT: org data is nested under "o" as {id, rol, slg}
	// Clerk v1 JWT: org data is at top-level "org_id"
	var orgID, orgRole string

	// Try v2 format first: "o": {"id": "org_...", "rol": "admin", "slg": "..."}
	if o, ok := claims["o"].(map[string]interface{}); ok {
		if id, ok := o["id"].(string); ok {
			orgID = id
		}
		if rol, ok := o["rol"].(string); ok {
			orgRole = rol
		}
	}

	// Fallback to v1 format: "org_id": "org_..."
	if orgID == "" {
		if v, ok := claims["org_id"].(string); ok {
			orgID = v
		}
	}
	if orgRole == "" {
		if v, ok := claims["org_role"].(string); ok {
			orgRole = v
		}
	}

	if orgID != "" {
		c.Set(ContextKeyOrgID, orgID)
	}
	if orgRole != "" {
		c.Set(ContextKeyOrgRole, orgRole)
	}

	// Extract plan from "pla" claim, e.g., "o:starter" -> "starter"
	if pla, ok := claims["pla"].(string); ok && pla != "" {
		plan := strings.TrimPrefix(pla, "o:")
		c.Set(ContextKeyPlan, plan)
	}
}

// GetOrgRole extracts the user's organization role from the Echo context.
func GetOrgRole(c echo.Context) string {
	if v, ok := c.Get(ContextKeyOrgRole).(string); ok {
		return v
	}
	return ""
}

// GetUserID extracts the authenticated user ID from the Echo context.
func GetUserID(c echo.Context) string {
	if v, ok := c.Get(ContextKeyUserID).(string); ok {
		return v
	}
	return ""
}

// GetOrgID extracts the authenticated organization ID from the Echo context.
func GetOrgID(c echo.Context) string {
	if v, ok := c.Get(ContextKeyOrgID).(string); ok {
		return v
	}
	return ""
}

// GetPlan extracts the organization's billing plan from the Echo context.
func GetPlan(c echo.Context) string {
	if v, ok := c.Get(ContextKeyPlan).(string); ok {
		return v
	}
	return ""
}
