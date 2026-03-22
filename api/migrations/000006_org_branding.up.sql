-- Organization branding / white-label settings (multi-tenant)
CREATE TABLE org_branding (
  organization_id VARCHAR(255) PRIMARY KEY REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
  display_name    VARCHAR(255),
  logo_url        TEXT,
  primary_color   VARCHAR(7),
  secondary_color VARCHAR(7),
  accent_color    VARCHAR(7),
  favicon_url     TEXT,
  custom_domain   VARCHAR(255),
  email_from_name VARCHAR(255),
  email_footer_text TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE org_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_branding FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_org_branding ON org_branding
  USING (organization_id = current_org_id());
