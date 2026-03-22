-- CRM connections (OAuth tokens)
CREATE TABLE crm_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL REFERENCES organizations(clerk_org_id),
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('salesforce', 'hubspot')),
  access_token TEXT,           -- encrypted in production
  refresh_token TEXT,          -- encrypted in production
  instance_url TEXT,           -- Salesforce instance URL
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  connected_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, platform)
);

CREATE INDEX idx_crm_connections_org ON crm_connections(organization_id);

-- Link projects to CRM deals
CREATE TABLE project_crm_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id VARCHAR(255) NOT NULL,
  platform VARCHAR(20) NOT NULL,
  crm_deal_id VARCHAR(255) NOT NULL,    -- Salesforce Opportunity ID or HubSpot Deal ID
  crm_deal_name VARCHAR(500),
  crm_deal_stage VARCHAR(255),
  crm_deal_amount DECIMAL(15,2),
  crm_deal_currency VARCHAR(3) DEFAULT 'USD',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_project_crm_links_project ON project_crm_links(project_id);
CREATE INDEX idx_project_crm_links_org ON project_crm_links(organization_id);

-- Enable RLS
ALTER TABLE crm_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_connections FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_crm_connections ON crm_connections
  USING (organization_id = current_org_id());

ALTER TABLE project_crm_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_crm_links FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_project_crm_links ON project_crm_links
  USING (organization_id = current_org_id());
