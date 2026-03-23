package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

// clerkSecretKey is set from main.go after config is loaded.
var clerkSecretKey string

// SetClerkSecretKey sets the Clerk Backend API secret key for user search.
func SetClerkSecretKey(key string) {
	clerkSecretKey = key
}

// clerkOrgMember represents a member in the Clerk organization members API response.
type clerkOrgMember struct {
	PublicUserData struct {
		UserID    string  `json:"user_id"`
		FirstName *string `json:"first_name"`
		LastName  *string `json:"last_name"`
		ImageURL  *string `json:"image_url"`
	} `json:"public_user_data"`
	Role string `json:"role"`
}

// clerkOrgMembersResponse is the Clerk API response for listing org members.
type clerkOrgMembersResponse struct {
	Data       []clerkOrgMember `json:"data"`
	TotalCount int              `json:"total_count"`
}

// clerkEmailAddress represents an email address in the Clerk user object.
type clerkEmailAddress struct {
	EmailAddress string `json:"email_address"`
	ID           string `json:"id"`
}

// clerkUser represents a user in the Clerk users API response.
type clerkUser struct {
	ID             string              `json:"id"`
	FirstName      *string             `json:"first_name"`
	LastName       *string             `json:"last_name"`
	ImageURL       *string             `json:"image_url"`
	EmailAddresses []clerkEmailAddress `json:"email_addresses"`
}

// userSearchResult is the JSON shape returned for each user in search results.
type userSearchResult struct {
	ID        string `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Email     string `json:"email"`
	ImageURL  string `json:"image_url"`
}

// SearchUsers — GET /api/users/search?q=searchterm
// Searches Clerk organization members by name or email.
func (h *Handler) SearchUsers(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	query := strings.TrimSpace(c.QueryParam("q"))
	if len(query) < 2 {
		return c.JSON(http.StatusOK, []userSearchResult{})
	}

	if clerkSecretKey == "" {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Clerk API key not configured"})
	}

	// Fetch organization members from Clerk Backend API
	members, err := fetchClerkOrgMembers(orgID)
	if err != nil {
		log.Printf("error fetching Clerk org members: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to fetch organization members"})
	}

	// Now fetch full user details for each member to get email addresses
	results := make([]userSearchResult, 0)
	queryLower := strings.ToLower(query)

	// Collect user IDs to batch-fetch
	userIDs := make([]string, 0, len(members))
	for _, m := range members {
		userIDs = append(userIDs, m.PublicUserData.UserID)
	}

	// Fetch user details (with emails) from Clerk
	users, err := fetchClerkUsers(userIDs)
	if err != nil {
		log.Printf("error fetching Clerk user details: %v", err)
		// Fall back to member data without emails
		for _, m := range members {
			firstName := derefStr(m.PublicUserData.FirstName)
			lastName := derefStr(m.PublicUserData.LastName)
			fullName := strings.ToLower(strings.TrimSpace(firstName + " " + lastName))
			if strings.Contains(fullName, queryLower) || strings.Contains(strings.ToLower(m.PublicUserData.UserID), queryLower) {
				results = append(results, userSearchResult{
					ID:        m.PublicUserData.UserID,
					FirstName: firstName,
					LastName:  lastName,
					ImageURL:  derefStr(m.PublicUserData.ImageURL),
				})
			}
		}
	} else {
		// Build a map for quick lookup
		userMap := make(map[string]clerkUser, len(users))
		for _, u := range users {
			userMap[u.ID] = u
		}

		for _, m := range members {
			u, ok := userMap[m.PublicUserData.UserID]
			if !ok {
				continue
			}
			firstName := derefStr(u.FirstName)
			lastName := derefStr(u.LastName)
			email := ""
			if len(u.EmailAddresses) > 0 {
				email = u.EmailAddresses[0].EmailAddress
			}

			fullName := strings.ToLower(strings.TrimSpace(firstName + " " + lastName))
			emailLower := strings.ToLower(email)

			if strings.Contains(fullName, queryLower) ||
				strings.Contains(emailLower, queryLower) ||
				strings.Contains(strings.ToLower(u.ID), queryLower) {
				results = append(results, userSearchResult{
					ID:        u.ID,
					FirstName: firstName,
					LastName:  lastName,
					Email:     email,
					ImageURL:  derefStr(u.ImageURL),
				})
			}
		}
	}

	// Limit results
	if len(results) > 20 {
		results = results[:20]
	}

	return c.JSON(http.StatusOK, results)
}

// fetchClerkOrgMembers fetches all members of a Clerk organization.
func fetchClerkOrgMembers(orgID string) ([]clerkOrgMember, error) {
	url := fmt.Sprintf("https://api.clerk.com/v1/organizations/%s/memberships?limit=100", orgID)

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
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
		return nil, fmt.Errorf("Clerk API returned status %d", resp.StatusCode)
	}

	var membersResp clerkOrgMembersResponse
	if err := json.NewDecoder(resp.Body).Decode(&membersResp); err != nil {
		return nil, fmt.Errorf("decoding Clerk response: %w", err)
	}

	return membersResp.Data, nil
}

// fetchClerkUsers fetches user details by IDs from Clerk Backend API.
func fetchClerkUsers(userIDs []string) ([]clerkUser, error) {
	if len(userIDs) == 0 {
		return nil, nil
	}

	// Clerk API: GET /v1/users?user_id=id1&user_id=id2&...
	params := make([]string, 0, len(userIDs))
	for _, id := range userIDs {
		params = append(params, "user_id="+id)
	}
	url := "https://api.clerk.com/v1/users?" + strings.Join(params, "&") + "&limit=100"

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
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
		return nil, fmt.Errorf("Clerk API returned status %d", resp.StatusCode)
	}

	var users []clerkUser
	if err := json.NewDecoder(resp.Body).Decode(&users); err != nil {
		return nil, fmt.Errorf("decoding Clerk response: %w", err)
	}

	return users, nil
}

// derefStr safely dereferences a string pointer, returning "" if nil.
func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
