-- Webhook integrations for Slack and Microsoft Teams
CREATE TABLE webhook_integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
  platform        VARCHAR(20) NOT NULL CHECK (platform IN ('slack', 'teams')),
  webhook_url     TEXT NOT NULL,
  channel_name    VARCHAR(255),
  is_active       BOOLEAN DEFAULT true,
  notify_on       JSONB DEFAULT '["answer_approved","rfp_drafted","rfp_parsed","deadline_approaching"]',
  created_by      VARCHAR(255) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_integrations_org ON webhook_integrations(organization_id);

-- Enable RLS
ALTER TABLE webhook_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_integrations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_webhook_integrations ON webhook_integrations
  USING (organization_id = current_org_id());
