package services

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"
)

// CRMService handles CRM integrations (Salesforce, HubSpot).
type CRMService struct {
	DB *sql.DB
}

// NewCRMService creates a new CRM service.
func NewCRMService(db *sql.DB) *CRMService {
	return &CRMService{DB: db}
}

// CRMConnection represents a stored CRM connection for an organization.
type CRMConnection struct {
	ID             string     `json:"id"`
	OrganizationID string     `json:"organization_id"`
	Platform       string     `json:"platform"`
	InstanceURL    *string    `json:"instance_url,omitempty"`
	IsActive       bool       `json:"is_active"`
	ConnectedBy    string     `json:"connected_by"`
	TokenExpiresAt *time.Time `json:"token_expires_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// CRMDeal represents a deal/opportunity from a CRM system.
type CRMDeal struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Stage    string  `json:"stage"`
	Amount   float64 `json:"amount"`
	Currency string  `json:"currency"`
}

// ProjectCRMLink represents a link between a project and a CRM deal.
type ProjectCRMLink struct {
	ID              string     `json:"id"`
	ProjectID       string     `json:"project_id"`
	OrganizationID  string     `json:"organization_id"`
	Platform        string     `json:"platform"`
	CRMDealID       string     `json:"crm_deal_id"`
	CRMDealName     *string    `json:"crm_deal_name,omitempty"`
	CRMDealStage    *string    `json:"crm_deal_stage,omitempty"`
	CRMDealAmount   *float64   `json:"crm_deal_amount,omitempty"`
	CRMDealCurrency string     `json:"crm_deal_currency"`
	LastSyncedAt    *time.Time `json:"last_synced_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

// ListConnections returns all CRM connections for an organization.
func (s *CRMService) ListConnections(ctx context.Context, orgID string) ([]CRMConnection, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, organization_id, platform, instance_url, is_active, connected_by, token_expires_at, created_at, updated_at
		FROM crm_connections
		WHERE organization_id = $1
		ORDER BY created_at DESC
	`, orgID)
	if err != nil {
		return nil, fmt.Errorf("list crm connections: %w", err)
	}
	defer rows.Close()

	var connections []CRMConnection
	for rows.Next() {
		var c CRMConnection
		if err := rows.Scan(&c.ID, &c.OrganizationID, &c.Platform, &c.InstanceURL, &c.IsActive, &c.ConnectedBy, &c.TokenExpiresAt, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan crm connection: %w", err)
		}
		connections = append(connections, c)
	}
	return connections, nil
}

// Connect creates a new CRM connection record.
// In production, this would initiate an OAuth flow and store real tokens.
func (s *CRMService) Connect(ctx context.Context, orgID, platform, userID string) (*CRMConnection, error) {
	var c CRMConnection
	err := s.DB.QueryRowContext(ctx, `
		INSERT INTO crm_connections (organization_id, platform, connected_by, is_active)
		VALUES ($1, $2, $3, true)
		ON CONFLICT (organization_id, platform) DO UPDATE
		SET is_active = true, connected_by = $3, updated_at = NOW()
		RETURNING id, organization_id, platform, instance_url, is_active, connected_by, token_expires_at, created_at, updated_at
	`, orgID, platform, userID).Scan(
		&c.ID, &c.OrganizationID, &c.Platform, &c.InstanceURL, &c.IsActive, &c.ConnectedBy, &c.TokenExpiresAt, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("connect crm: %w", err)
	}
	return &c, nil
}

// Disconnect deactivates a CRM connection and clears tokens.
func (s *CRMService) Disconnect(ctx context.Context, orgID, connectionID string) error {
	res, err := s.DB.ExecContext(ctx, `
		UPDATE crm_connections
		SET is_active = false, access_token = NULL, refresh_token = NULL, updated_at = NOW()
		WHERE id = $1 AND organization_id = $2
	`, connectionID, orgID)
	if err != nil {
		return fmt.Errorf("disconnect crm: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("crm connection not found")
	}
	return nil
}

// SyncDeal syncs a project outcome to the linked CRM deal.
// In production, this would call Salesforce/HubSpot APIs to update the deal stage.
func (s *CRMService) SyncDeal(ctx context.Context, orgID, projectID string) error {
	// 1. Get CRM link for this project
	var link ProjectCRMLink
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, project_id, organization_id, platform, crm_deal_id, crm_deal_name, crm_deal_stage
		FROM project_crm_links
		WHERE project_id = $1 AND organization_id = $2
	`, projectID, orgID).Scan(&link.ID, &link.ProjectID, &link.OrganizationID, &link.Platform, &link.CRMDealID, &link.CRMDealName, &link.CRMDealStage)
	if err == sql.ErrNoRows {
		return fmt.Errorf("no CRM link found for project")
	}
	if err != nil {
		return fmt.Errorf("get crm link: %w", err)
	}

	// 2. Get project status
	var projectStatus string
	err = s.DB.QueryRowContext(ctx, `
		SELECT status FROM projects WHERE id = $1 AND organization_id = $2
	`, projectID, orgID).Scan(&projectStatus)
	if err != nil {
		return fmt.Errorf("get project status: %w", err)
	}

	// 3. Placeholder: would call CRM API to update deal stage
	log.Printf("[CRM SYNC] Would update %s deal %s for project %s (status: %s)", link.Platform, link.CRMDealID, projectID, projectStatus)

	// 4. Update last_synced_at
	_, err = s.DB.ExecContext(ctx, `
		UPDATE project_crm_links SET last_synced_at = NOW() WHERE id = $1
	`, link.ID)
	if err != nil {
		return fmt.Errorf("update sync timestamp: %w", err)
	}

	return nil
}

// ListDeals fetches deals from CRM.
// In production, this would call Salesforce/HubSpot APIs using stored OAuth tokens.
func (s *CRMService) ListDeals(ctx context.Context, orgID, platform string) ([]CRMDeal, error) {
	// Placeholder: return empty list
	// In production: use access_token from crm_connections to call CRM API
	log.Printf("[CRM] ListDeals called for org=%s platform=%s (placeholder)", orgID, platform)
	return []CRMDeal{}, nil
}

// LinkProjectToDeal creates a link between a project and a CRM deal.
func (s *CRMService) LinkProjectToDeal(ctx context.Context, orgID, projectID string, link *ProjectCRMLink) (*ProjectCRMLink, error) {
	var result ProjectCRMLink
	err := s.DB.QueryRowContext(ctx, `
		INSERT INTO project_crm_links (project_id, organization_id, platform, crm_deal_id, crm_deal_name, crm_deal_stage, crm_deal_amount, crm_deal_currency)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, project_id, organization_id, platform, crm_deal_id, crm_deal_name, crm_deal_stage, crm_deal_amount, crm_deal_currency, last_synced_at, created_at
	`, projectID, orgID, link.Platform, link.CRMDealID, link.CRMDealName, link.CRMDealStage, link.CRMDealAmount, link.CRMDealCurrency,
	).Scan(
		&result.ID, &result.ProjectID, &result.OrganizationID, &result.Platform,
		&result.CRMDealID, &result.CRMDealName, &result.CRMDealStage,
		&result.CRMDealAmount, &result.CRMDealCurrency, &result.LastSyncedAt, &result.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("link project to deal: %w", err)
	}
	return &result, nil
}

// GetProjectCRMLink returns the CRM link for a project.
func (s *CRMService) GetProjectCRMLink(ctx context.Context, orgID, projectID string) (*ProjectCRMLink, error) {
	var link ProjectCRMLink
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, project_id, organization_id, platform, crm_deal_id, crm_deal_name, crm_deal_stage, crm_deal_amount, crm_deal_currency, last_synced_at, created_at
		FROM project_crm_links
		WHERE project_id = $1 AND organization_id = $2
	`, projectID, orgID).Scan(
		&link.ID, &link.ProjectID, &link.OrganizationID, &link.Platform,
		&link.CRMDealID, &link.CRMDealName, &link.CRMDealStage,
		&link.CRMDealAmount, &link.CRMDealCurrency, &link.LastSyncedAt, &link.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get project crm link: %w", err)
	}
	return &link, nil
}

// UnlinkProjectFromDeal removes the CRM link for a project.
func (s *CRMService) UnlinkProjectFromDeal(ctx context.Context, orgID, projectID string) error {
	res, err := s.DB.ExecContext(ctx, `
		DELETE FROM project_crm_links WHERE project_id = $1 AND organization_id = $2
	`, projectID, orgID)
	if err != nil {
		return fmt.Errorf("unlink project from deal: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("no CRM link found for project")
	}
	return nil
}
