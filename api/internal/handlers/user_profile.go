package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
)

// ── Types ────────────────────────────────────────────────────────────────────

// userProfileResponse is the shape returned to the frontend.
type userProfileResponse struct {
	ID             string `json:"id"`
	FirstName      string `json:"first_name"`
	LastName       string `json:"last_name"`
	Email          string `json:"email"`
	ImageURL       string `json:"image_url"`
	HasPassword    bool   `json:"has_password"`
	TwoFactorEnabled bool `json:"two_factor_enabled"`
	TOTPEnabled    bool   `json:"totp_enabled"`
}

// clerkUserFull is an extended Clerk user for profile operations.
type clerkUserFull struct {
	ID                  string              `json:"id"`
	FirstName           *string             `json:"first_name"`
	LastName            *string             `json:"last_name"`
	ImageURL            *string             `json:"image_url"`
	EmailAddresses      []clerkEmailAddress `json:"email_addresses"`
	PasswordEnabled     bool                `json:"password_enabled"`
	TwoFactorEnabled    bool                `json:"two_factor_enabled"`
	TOTPEnabled         bool                `json:"totp_enabled"`
}

// ── GET /api/user/profile ────────────────────────────────────────────────────

// GetUserProfile returns the current user's profile from Clerk.
func (h *Handler) GetUserProfile(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "user_id is required"})
	}

	u, err := fetchClerkUserFull(userID)
	if err != nil {
		log.Printf("error fetching Clerk user profile: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to fetch user profile"})
	}

	email := ""
	if len(u.EmailAddresses) > 0 {
		email = u.EmailAddresses[0].EmailAddress
	}

	return c.JSON(http.StatusOK, userProfileResponse{
		ID:               u.ID,
		FirstName:        derefStr(u.FirstName),
		LastName:         derefStr(u.LastName),
		Email:            email,
		ImageURL:         derefStr(u.ImageURL),
		HasPassword:      u.PasswordEnabled,
		TwoFactorEnabled: u.TwoFactorEnabled,
		TOTPEnabled:      u.TOTPEnabled,
	})
}

// ── PUT /api/user/profile ────────────────────────────────────────────────────

type updateProfileRequest struct {
	FirstName *string `json:"first_name"`
	LastName  *string `json:"last_name"`
}

// UpdateUserProfile updates the current user's name in Clerk.
func (h *Handler) UpdateUserProfile(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "user_id is required"})
	}

	var req updateProfileRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	body := make(map[string]interface{})
	if req.FirstName != nil {
		body["first_name"] = *req.FirstName
	}
	if req.LastName != nil {
		body["last_name"] = *req.LastName
	}

	result, err := patchClerkUser(userID, body)
	if err != nil {
		log.Printf("error updating Clerk user profile: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update profile"})
	}

	email := ""
	if len(result.EmailAddresses) > 0 {
		email = result.EmailAddresses[0].EmailAddress
	}

	return c.JSON(http.StatusOK, userProfileResponse{
		ID:               result.ID,
		FirstName:        derefStr(result.FirstName),
		LastName:         derefStr(result.LastName),
		Email:            email,
		ImageURL:         derefStr(result.ImageURL),
		HasPassword:      result.PasswordEnabled,
		TwoFactorEnabled: result.TwoFactorEnabled,
		TOTPEnabled:      result.TOTPEnabled,
	})
}

// ── PUT /api/user/password ───────────────────────────────────────────────────

type updatePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// UpdateUserPassword updates the current user's password in Clerk.
func (h *Handler) UpdateUserPassword(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "user_id is required"})
	}

	var req updatePasswordRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if req.NewPassword == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "new_password is required"})
	}

	body := map[string]interface{}{
		"password": req.NewPassword,
	}
	if req.CurrentPassword != "" {
		body["current_password"] = req.CurrentPassword
	}

	_, err := patchClerkUser(userID, body)
	if err != nil {
		log.Printf("error updating Clerk user password: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update password"})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

// ── POST /api/user/avatar ────────────────────────────────────────────────────

// UploadUserAvatar uploads a new profile image for the current user.
func (h *Handler) UploadUserAvatar(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "user_id is required"})
	}

	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file is required"})
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to read file"})
	}
	defer src.Close()

	fileBytes, err := io.ReadAll(src)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to read file"})
	}

	// Upload to Clerk Backend API
	url := fmt.Sprintf("https://api.clerk.com/v1/users/%s/profile_image", userID)

	// Build multipart form
	var buf bytes.Buffer
	writer := newMultipartWriter(&buf)
	part, err := writer.CreateFormFile("file", file.Filename)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to build upload"})
	}
	if _, err := part.Write(fileBytes); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to build upload"})
	}
	writer.Close()

	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest("POST", url, &buf)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create request"})
	}
	req.Header.Set("Authorization", "Bearer "+clerkSecretKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("error uploading avatar to Clerk: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to upload avatar"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		log.Printf("Clerk avatar upload returned %d: %s", resp.StatusCode, string(respBody))
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to upload avatar"})
	}

	// Return the updated user profile
	u, err := fetchClerkUserFull(userID)
	if err != nil {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"status":    "ok",
		"image_url": derefStr(u.ImageURL),
	})
}

// DeleteUserAvatar removes the current user's profile image.
func (h *Handler) DeleteUserAvatar(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "user_id is required"})
	}

	url := fmt.Sprintf("https://api.clerk.com/v1/users/%s/profile_image", userID)

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create request"})
	}
	req.Header.Set("Authorization", "Bearer "+clerkSecretKey)

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("error deleting Clerk avatar: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete avatar"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete avatar"})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

// ── 2FA / TOTP ──────────────────────────────────────────────────────────────

// GetUser2FAStatus returns the current user's 2FA status.
func (h *Handler) GetUser2FAStatus(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "user_id is required"})
	}

	u, err := fetchClerkUserFull(userID)
	if err != nil {
		log.Printf("error fetching Clerk user for 2FA status: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to fetch 2FA status"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"two_factor_enabled": u.TwoFactorEnabled,
		"totp_enabled":       u.TOTPEnabled,
	})
}

// DisableUserMFA disables all MFA methods for the current user via Clerk Backend API.
func (h *Handler) DisableUserMFA(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "user_id is required"})
	}

	url := fmt.Sprintf("https://api.clerk.com/v1/users/%s/mfa", userID)

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create request"})
	}
	req.Header.Set("Authorization", "Bearer "+clerkSecretKey)

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("error disabling MFA: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to disable 2FA"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		log.Printf("Clerk MFA disable returned %d: %s", resp.StatusCode, string(respBody))
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to disable 2FA"})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

// ── Clerk helpers ────────────────────────────────────────────────────────────

func fetchClerkUserFull(userID string) (*clerkUserFull, error) {
	url := fmt.Sprintf("https://api.clerk.com/v1/users/%s", userID)

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+clerkSecretKey)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("calling Clerk API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Clerk API returned status %d", resp.StatusCode)
	}

	var u clerkUserFull
	if err := json.NewDecoder(resp.Body).Decode(&u); err != nil {
		return nil, fmt.Errorf("decoding Clerk response: %w", err)
	}

	return &u, nil
}

func patchClerkUser(userID string, body map[string]interface{}) (*clerkUserFull, error) {
	url := fmt.Sprintf("https://api.clerk.com/v1/users/%s", userID)

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshaling body: %w", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("PATCH", url, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+clerkSecretKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("calling Clerk API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Clerk API returned %d: %s", resp.StatusCode, string(respBody))
	}

	var u clerkUserFull
	if err := json.NewDecoder(resp.Body).Decode(&u); err != nil {
		return nil, fmt.Errorf("decoding Clerk response: %w", err)
	}

	return &u, nil
}

// newMultipartWriter is a helper that returns a multipart.Writer.
func newMultipartWriter(buf *bytes.Buffer) *multipartWriter {
	return &multipartWriter{buf: buf, boundary: fmt.Sprintf("---boundary%d", time.Now().UnixNano())}
}

type multipartWriter struct {
	buf      *bytes.Buffer
	boundary string
	closed   bool
}

func (w *multipartWriter) CreateFormFile(fieldname, filename string) (io.Writer, error) {
	fmt.Fprintf(w.buf, "--%s\r\nContent-Disposition: form-data; name=\"%s\"; filename=\"%s\"\r\nContent-Type: application/octet-stream\r\n\r\n", w.boundary, fieldname, filename)
	return w.buf, nil
}

func (w *multipartWriter) Close() error {
	fmt.Fprintf(w.buf, "\r\n--%s--\r\n", w.boundary)
	w.closed = true
	return nil
}

func (w *multipartWriter) FormDataContentType() string {
	return "multipart/form-data; boundary=" + w.boundary
}
