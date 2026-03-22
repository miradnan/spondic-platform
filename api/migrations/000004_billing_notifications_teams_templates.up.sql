-- ============================================================================
-- Migration 004: Billing, Notifications, Templates, Project Outcomes
--
-- New tables: subscriptions, invoices, usage_records, plan_limits,
--             notifications, notification_preferences, answer_templates,
--             project_outcomes
--
-- Altered tables: projects (add team_id), rfp_questions (add assigned_to)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Billing tables
-- ---------------------------------------------------------------------------

-- ── subscriptions ───────────────────────────────────────────────────────────
CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         VARCHAR(255) NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
  stripe_customer_id      VARCHAR(255) NOT NULL,
  stripe_subscription_id  VARCHAR(255) UNIQUE,
  plan                    VARCHAR(50) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'growth', 'enterprise')),
  status                  VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing', 'incomplete')),
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at               TIMESTAMPTZ,
  canceled_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id)
);

CREATE INDEX idx_subscriptions_organization_id ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);

-- ── invoices ────────────────────────────────────────────────────────────────
CREATE TABLE invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   VARCHAR(255) NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
  stripe_invoice_id VARCHAR(255) UNIQUE,
  amount_cents      INTEGER NOT NULL,
  currency          VARCHAR(10) DEFAULT 'inr',
  status            VARCHAR(50) NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  invoice_url       TEXT,
  period_start      TIMESTAMPTZ,
  period_end        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_organization_id ON invoices(organization_id);
CREATE INDEX idx_invoices_status ON invoices(organization_id, status);
CREATE INDEX idx_invoices_stripe_invoice_id ON invoices(stripe_invoice_id);

-- ── usage_records ───────────────────────────────────────────────────────────
CREATE TABLE usage_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
  metric          VARCHAR(100) NOT NULL CHECK (metric IN ('rfps_processed', 'documents_uploaded', 'questions_drafted', 'users')),
  count           INTEGER NOT NULL DEFAULT 0,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, metric, period_start)
);

CREATE INDEX idx_usage_records_organization_id ON usage_records(organization_id);
CREATE INDEX idx_usage_records_period ON usage_records(organization_id, period_start, period_end);

-- ── plan_limits ─────────────────────────────────────────────────────────────
CREATE TABLE plan_limits (
  plan                  VARCHAR(50) PRIMARY KEY,
  max_rfps_per_month    INTEGER,
  max_documents         INTEGER,
  max_users             INTEGER,
  max_questions_per_rfp INTEGER,
  ai_review_enabled     BOOLEAN DEFAULT false,
  compliance_enabled    BOOLEAN DEFAULT false,
  template_library      BOOLEAN DEFAULT false,
  analytics_enabled     BOOLEAN DEFAULT false
);

INSERT INTO plan_limits VALUES
  ('free',       5,    20,   3,    50,   false, false, false, false),
  ('starter',    20,   100,  10,   200,  false, false, true,  true),
  ('growth',     100,  500,  50,   500,  true,  true,  true,  true),
  ('enterprise', NULL, NULL, NULL, NULL, true,  true,  true,  true);

-- ---------------------------------------------------------------------------
-- 2. Notification tables
-- ---------------------------------------------------------------------------

-- ── notifications ───────────────────────────────────────────────────────────
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
  user_id         VARCHAR(255) NOT NULL,
  type            VARCHAR(50) NOT NULL CHECK (type IN (
    'answer_approved', 'comment_added', 'document_indexed', 'rfp_parsed',
    'rfp_drafted', 'deadline_approaching', 'team_assignment', 'question_assigned'
  )),
  title           TEXT NOT NULL,
  body            TEXT,
  entity_type     VARCHAR(50),
  entity_id       VARCHAR(255),
  is_read         BOOLEAN DEFAULT false,
  email_sent      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_organization_id ON notifications(organization_id);
CREATE INDEX idx_notifications_user ON notifications(organization_id, user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(organization_id, created_at DESC);

-- ── notification_preferences ────────────────────────────────────────────────
CREATE TABLE notification_preferences (
  organization_id  VARCHAR(255) NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
  user_id          VARCHAR(255) NOT NULL,
  type             VARCHAR(50) NOT NULL,
  in_app_enabled   BOOLEAN DEFAULT true,
  email_enabled    BOOLEAN DEFAULT false,
  PRIMARY KEY (organization_id, user_id, type)
);

CREATE INDEX idx_notification_preferences_user ON notification_preferences(organization_id, user_id);

-- ---------------------------------------------------------------------------
-- 3. Templates
-- ---------------------------------------------------------------------------

-- ── answer_templates ────────────────────────────────────────────────────────
CREATE TABLE answer_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  VARCHAR(255) NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  category         VARCHAR(100),
  question_pattern TEXT,
  answer_template  TEXT NOT NULL,
  created_by       VARCHAR(255) NOT NULL,
  usage_count      INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX idx_answer_templates_organization_id ON answer_templates(organization_id);
CREATE INDEX idx_answer_templates_category ON answer_templates(organization_id, category);
CREATE INDEX idx_answer_templates_deleted_at ON answer_templates(deleted_at) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Project Outcomes (Win/Loss)
-- ---------------------------------------------------------------------------

-- ── project_outcomes ────────────────────────────────────────────────────────
CREATE TABLE project_outcomes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id VARCHAR(255) NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
  outcome         VARCHAR(50) NOT NULL CHECK (outcome IN ('won', 'lost', 'no_decision', 'pending')),
  revenue_cents   BIGINT,
  currency        VARCHAR(10) DEFAULT 'inr',
  feedback        TEXT,
  loss_reason     VARCHAR(100),
  submitted_at    TIMESTAMPTZ,
  decided_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id)
);

CREATE INDEX idx_project_outcomes_organization_id ON project_outcomes(organization_id);
CREATE INDEX idx_project_outcomes_outcome ON project_outcomes(organization_id, outcome);

-- ---------------------------------------------------------------------------
-- 5. Alter existing tables
-- ---------------------------------------------------------------------------

ALTER TABLE projects ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE rfp_questions ADD COLUMN assigned_to VARCHAR(255);

CREATE INDEX idx_projects_team_id ON projects(team_id);
CREATE INDEX idx_rfp_questions_assigned_to ON rfp_questions(organization_id, assigned_to);

-- ---------------------------------------------------------------------------
-- 6. Row Level Security for all new tables
-- ---------------------------------------------------------------------------

-- ── subscriptions ───────────────────────────────────────────────────────────
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_subscriptions ON subscriptions
  USING (organization_id = current_org_id());

-- ── invoices ────────────────────────────────────────────────────────────────
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_invoices ON invoices
  USING (organization_id = current_org_id());

-- ── usage_records ───────────────────────────────────────────────────────────
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_usage_records ON usage_records
  USING (organization_id = current_org_id());

-- ── notifications ───────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_notifications ON notifications
  USING (organization_id = current_org_id());

-- ── notification_preferences ────────────────────────────────────────────────
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_notification_preferences ON notification_preferences
  USING (organization_id = current_org_id());

-- ── answer_templates ────────────────────────────────────────────────────────
ALTER TABLE answer_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE answer_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_answer_templates ON answer_templates
  USING (organization_id = current_org_id());

-- ── project_outcomes ────────────────────────────────────────────────────────
ALTER TABLE project_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_outcomes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_project_outcomes ON project_outcomes
  USING (organization_id = current_org_id());

-- NOTE: plan_limits has no organization_id — it is a global reference table.
-- No RLS needed.
