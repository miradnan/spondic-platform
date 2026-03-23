package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

// defaultTeamNames are seeded when an org first uses the Teams feature.
var defaultTeamNames = []string{
	"Procurement",
	"Technical",
	"Finance",
	"Legal Protection",
	"Business",
	"Risk Management",
}

// teamRow is the JSON shape returned for a team (includes member_count).
type teamRow struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	Name           string    `json:"name"`
	MemberCount    int       `json:"member_count"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// teamMemberRow is the JSON shape returned for a team member.
type teamMemberRow struct {
	TeamID    string    `json:"team_id"`
	UserID    string    `json:"user_id"`
	FirstName string    `json:"first_name,omitempty"`
	LastName  string    `json:"last_name,omitempty"`
	Email     string    `json:"email,omitempty"`
	ImageURL  string    `json:"image_url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// ── ListTeams — GET /api/teams ──────────────────────────────────────────────

func (h *Handler) ListTeams(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	rows, err := h.DB.Query(
		`SELECT t.id, t.organization_id, t.name, t.created_at, t.updated_at,
		        COALESCE((SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id), 0) AS member_count
		 FROM teams t
		 WHERE t.organization_id = $1 AND t.deleted_at IS NULL
		 ORDER BY t.name`,
		orgID,
	)
	if err != nil {
		log.Printf("error listing teams: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	teams := make([]teamRow, 0)
	for rows.Next() {
		var t teamRow
		if err := rows.Scan(&t.ID, &t.OrganizationID, &t.Name, &t.CreatedAt, &t.UpdatedAt, &t.MemberCount); err != nil {
			log.Printf("error scanning team: %v", err)
			continue
		}
		teams = append(teams, t)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"teams": teams,
		"total": len(teams),
	})
}

// ── CreateTeam — POST /api/teams ────────────────────────────────────────────

func (h *Handler) CreateTeam(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	var body struct {
		Name string `json:"name"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if body.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "name is required"})
	}

	var t teamRow
	err := h.DB.QueryRow(
		`INSERT INTO teams (organization_id, name)
		 VALUES ($1, $2)
		 RETURNING id, organization_id, name, created_at, updated_at`,
		orgID, body.Name,
	).Scan(&t.ID, &t.OrganizationID, &t.Name, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		log.Printf("error creating team: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.JSON(http.StatusCreated, t)
}

// ── UpdateTeam — PUT /api/teams/:id ─────────────────────────────────────────

func (h *Handler) UpdateTeam(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}
	teamID := c.Param("id")

	var body struct {
		Name string `json:"name"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if body.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "name is required"})
	}

	var t teamRow
	err := h.DB.QueryRow(
		`UPDATE teams SET name = $1, updated_at = NOW()
		 WHERE id = $2 AND organization_id = $3 AND deleted_at IS NULL
		 RETURNING id, organization_id, name, created_at, updated_at`,
		body.Name, teamID, orgID,
	).Scan(&t.ID, &t.OrganizationID, &t.Name, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		log.Printf("error updating team: %v", err)
		return c.JSON(http.StatusNotFound, map[string]string{"error": "team not found"})
	}

	return c.JSON(http.StatusOK, t)
}

// ── DeleteTeam — DELETE /api/teams/:id ──────────────────────────────────────

func (h *Handler) DeleteTeam(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}
	teamID := c.Param("id")

	// Soft-delete the team
	result, err := h.DB.Exec(
		`UPDATE teams SET deleted_at = NOW()
		 WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
		teamID, orgID,
	)
	if err != nil {
		log.Printf("error deleting team: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	affected, _ := result.RowsAffected()
	if affected == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "team not found"})
	}

	// Remove all members of the deleted team
	_, _ = h.DB.Exec(`DELETE FROM team_members WHERE team_id = $1`, teamID)

	return c.NoContent(http.StatusNoContent)
}

// ── ListTeamMembers — GET /api/teams/:id/members ────────────────────────────

func (h *Handler) ListTeamMembers(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}
	teamID := c.Param("id")

	// Verify team belongs to org
	var exists bool
	err := h.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM teams WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL)`,
		teamID, orgID,
	).Scan(&exists)
	if err != nil || !exists {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "team not found"})
	}

	rows, err := h.DB.Query(
		`SELECT team_id, user_id, created_at
		 FROM team_members
		 WHERE team_id = $1
		 ORDER BY created_at`,
		teamID,
	)
	if err != nil {
		log.Printf("error listing team members: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	members := make([]teamMemberRow, 0)
	for rows.Next() {
		var m teamMemberRow
		if err := rows.Scan(&m.TeamID, &m.UserID, &m.CreatedAt); err != nil {
			log.Printf("error scanning team member: %v", err)
			continue
		}
		members = append(members, m)
	}

	// Enrich members with Clerk user details
	if clerkSecretKey != "" && len(members) > 0 {
		enrichTeamMembers(members)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"members": members,
		"total":   len(members),
	})
}

// ── AddTeamMember — POST /api/teams/:id/members ─────────────────────────────

func (h *Handler) AddTeamMember(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}
	teamID := c.Param("id")

	var body struct {
		UserID string `json:"user_id"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if body.UserID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "user_id is required"})
	}

	// Verify team belongs to org
	var exists bool
	err := h.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM teams WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL)`,
		teamID, orgID,
	).Scan(&exists)
	if err != nil || !exists {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "team not found"})
	}

	var m teamMemberRow
	err = h.DB.QueryRow(
		`INSERT INTO team_members (team_id, user_id)
		 VALUES ($1, $2)
		 ON CONFLICT (team_id, user_id) DO NOTHING
		 RETURNING team_id, user_id, created_at`,
		teamID, body.UserID,
	).Scan(&m.TeamID, &m.UserID, &m.CreatedAt)
	if err != nil {
		// ON CONFLICT DO NOTHING returns no rows — member already exists
		return c.JSON(http.StatusOK, map[string]string{"status": "already_member"})
	}

	return c.JSON(http.StatusCreated, m)
}

// ── RemoveTeamMember — DELETE /api/teams/:id/members/:userId ────────────────

func (h *Handler) RemoveTeamMember(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}
	teamID := c.Param("id")
	userID := c.Param("userId")

	// Verify team belongs to org
	var exists bool
	err := h.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM teams WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL)`,
		teamID, orgID,
	).Scan(&exists)
	if err != nil || !exists {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "team not found"})
	}

	result, err := h.DB.Exec(
		`DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`,
		teamID, userID,
	)
	if err != nil {
		log.Printf("error removing team member: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	affected, _ := result.RowsAffected()
	if affected == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "member not found"})
	}

	return c.NoContent(http.StatusNoContent)
}

// ── SeedDefaultTeams — POST /api/teams/seed ─────────────────────────────────

func (h *Handler) SeedDefaultTeams(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	// Check if org already has any teams
	var count int
	err := h.DB.QueryRow(
		`SELECT COUNT(*) FROM teams WHERE organization_id = $1 AND deleted_at IS NULL`,
		orgID,
	).Scan(&count)
	if err != nil {
		log.Printf("error counting teams: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	if count > 0 {
		// Already seeded — return existing teams
		return h.seedResponse(c, orgID, false)
	}

	// Insert default teams
	for _, name := range defaultTeamNames {
		_, err := h.DB.Exec(
			`INSERT INTO teams (organization_id, name) VALUES ($1, $2)`,
			orgID, name,
		)
		if err != nil {
			log.Printf("error seeding team %q: %v", name, err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		}
	}

	return h.seedResponse(c, orgID, true)
}

// seedResponse fetches all teams for the org and returns the seed response.
func (h *Handler) seedResponse(c echo.Context, orgID string, created bool) error {
	rows, err := h.DB.Query(
		`SELECT t.id, t.organization_id, t.name, t.created_at, t.updated_at,
		        COALESCE((SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id), 0) AS member_count
		 FROM teams t
		 WHERE t.organization_id = $1 AND t.deleted_at IS NULL
		 ORDER BY t.name`,
		orgID,
	)
	if err != nil {
		log.Printf("error listing teams after seed: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	teams := make([]teamRow, 0)
	for rows.Next() {
		var t teamRow
		if err := rows.Scan(&t.ID, &t.OrganizationID, &t.Name, &t.CreatedAt, &t.UpdatedAt, &t.MemberCount); err != nil {
			log.Printf("error scanning team: %v", err)
			continue
		}
		teams = append(teams, t)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"teams":   teams,
		"created": created,
	})
}

// ── enrichTeamMembers — resolve Clerk user details for team members ──────────

func enrichTeamMembers(members []teamMemberRow) {
	if len(members) == 0 {
		return
	}

	// Collect user IDs
	ids := make([]string, len(members))
	for i, m := range members {
		ids[i] = m.UserID
	}

	// Batch fetch from Clerk: GET /v1/users?user_id=...&user_id=...
	reqURL := "https://api.clerk.com/v1/users?" + strings.Join(func() []string {
		params := make([]string, len(ids))
		for i, id := range ids {
			params[i] = "user_id=" + id
		}
		return params
	}(), "&")

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		log.Printf("enrichTeamMembers: failed to create request: %v", err)
		return
	}
	req.Header.Set("Authorization", "Bearer "+clerkSecretKey)

	resp, err := (&http.Client{Timeout: 5 * time.Second}).Do(req)
	if err != nil {
		log.Printf("enrichTeamMembers: Clerk API error: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("enrichTeamMembers: Clerk API returned %d: %s", resp.StatusCode, body)
		return
	}

	var clerkUsers []struct {
		ID             string `json:"id"`
		FirstName      *string `json:"first_name"`
		LastName       *string `json:"last_name"`
		ImageURL       *string `json:"image_url"`
		EmailAddresses []struct {
			EmailAddress string `json:"email_address"`
		} `json:"email_addresses"`
		PrimaryEmailAddressID *string `json:"primary_email_address_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&clerkUsers); err != nil {
		log.Printf("enrichTeamMembers: failed to decode Clerk response: %v", err)
		return
	}

	// Build lookup map
	userMap := make(map[string]int, len(clerkUsers))
	for i, u := range clerkUsers {
		userMap[u.ID] = i
	}

	// Enrich members
	for i := range members {
		idx, ok := userMap[members[i].UserID]
		if !ok {
			continue
		}
		u := clerkUsers[idx]
		if u.FirstName != nil {
			members[i].FirstName = *u.FirstName
		}
		if u.LastName != nil {
			members[i].LastName = *u.LastName
		}
		if u.ImageURL != nil {
			members[i].ImageURL = *u.ImageURL
		}
		if len(u.EmailAddresses) > 0 {
			members[i].Email = u.EmailAddresses[0].EmailAddress
		}
	}

	_ = fmt.Sprintf // ensure fmt is used
}
