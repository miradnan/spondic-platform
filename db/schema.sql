-- Spondic PostgreSQL schema
-- Run with: psql -h localhost -U postgres -d your_database -f db/schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ---------------------------------------------------------------------------
-- Organizations (clerk_org_id as primary key)
-- ---------------------------------------------------------------------------
CREATE TABLE organizations (
  clerk_org_id VARCHAR(255) PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Teams
-- ---------------------------------------------------------------------------
CREATE TABLE teams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ NULL
);

CREATE INDEX idx_teams_organization_id ON teams(organization_id);
CREATE INDEX idx_teams_deleted_at ON teams(deleted_at) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Team members
-- ---------------------------------------------------------------------------
CREATE TABLE team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,  -- clerk_user_id
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX idx_team_members_user_id ON team_members(user_id);

-- ---------------------------------------------------------------------------
-- Tags (referenced by document_tags)
-- ---------------------------------------------------------------------------
CREATE TABLE tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tags_organization_id ON tags(organization_id);

-- ---------------------------------------------------------------------------
-- Documents (multi-tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weaviate_object_id  UUID,
  organization_id     VARCHAR(255) NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
  uploaded_by_user_id VARCHAR(255) NOT NULL,
  title               TEXT,
  description         TEXT,
  source_type         VARCHAR(50),
  source_url          TEXT,
  file_name           TEXT,
  file_size_bytes     BIGINT,
  content_hash        VARCHAR(255),
  version             INTEGER DEFAULT 1,
  status              VARCHAR(50) NOT NULL DEFAULT 'processing',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ NULL
);

CREATE INDEX idx_documents_organization_id ON documents(organization_id);
CREATE INDEX idx_documents_status ON documents(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_deleted_at ON documents(deleted_at) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Document chunks (multi-tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE document_chunks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id         UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  weaviate_object_id  UUID,
  organization_id     VARCHAR(255) NOT NULL,
  chunk_index         INTEGER DEFAULT 0,
  token_count         INTEGER DEFAULT 0,
  embedding_model     VARCHAR(100) NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ NULL
);

CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_organization_id ON document_chunks(organization_id);

-- ---------------------------------------------------------------------------
-- Document tags (multi-tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE document_tags (
  organization_id VARCHAR(255) NOT NULL,
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id          UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (organization_id, document_id, tag_id)
);

CREATE INDEX idx_document_tags_document_id ON document_tags(document_id);

-- ---------------------------------------------------------------------------
-- Audit logs (multi-tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  organization_id VARCHAR(255) NOT NULL,
  user_id         VARCHAR(255) NOT NULL,
  action          VARCHAR(100) NOT NULL,
  entity_type     VARCHAR(100),
  entity_id       VARCHAR(255),
  metadata        JSONB,
  ip_address      VARCHAR(100),
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_org_created ON audit_logs(organization_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Document metrics (multi-tenant, per-document)
-- ---------------------------------------------------------------------------
CREATE TABLE document_metrics (
  organization_id   VARCHAR(255) NOT NULL,
  document_id       UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  search_count      BIGINT DEFAULT 0,
  last_accessed_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (organization_id, document_id)
);

-- ---------------------------------------------------------------------------
-- Document versions (multi-tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE document_versions (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            VARCHAR(255) NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
  document_id                UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version                    INTEGER NOT NULL,
  previous_embedding_snapshot JSONB,
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (document_id, version)
);

CREATE INDEX idx_document_versions_document_id ON document_versions(document_id);

-- ---------------------------------------------------------------------------
-- Chats
-- ---------------------------------------------------------------------------
CREATE TABLE chats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
  user_id         VARCHAR(255) NOT NULL,
  title           CITEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ NULL
);

CREATE INDEX idx_chats_organization_user ON chats(organization_id, user_id);
CREATE INDEX idx_chats_deleted_at ON chats(deleted_at) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Chat messages
-- ---------------------------------------------------------------------------
CREATE TABLE chat_messages (
  id         BIGSERIAL PRIMARY KEY,
  chat_id    UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role       VARCHAR(20) NOT NULL,  -- 'user' | 'assistant'
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(chat_id, created_at);

-- ---------------------------------------------------------------------------
-- Projects (RFP projects, multi-tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  deadline        TIMESTAMPTZ,
  status          VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'submitted')),
  team_id         UUID REFERENCES teams(id) ON DELETE SET NULL,
  created_by      VARCHAR(255) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_projects_status ON projects(organization_id, status);
CREATE INDEX idx_projects_team_id ON projects(team_id);

-- ---------------------------------------------------------------------------
-- Project documents (link RFP files to projects)
-- ---------------------------------------------------------------------------
CREATE TABLE project_documents (
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, document_id)
);

-- ---------------------------------------------------------------------------
-- RFP questions (extracted from RFP documents)
-- ---------------------------------------------------------------------------
CREATE TABLE rfp_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id VARCHAR(255) NOT NULL,
  question_text   TEXT NOT NULL,
  section         TEXT,
  question_number INTEGER,
  is_mandatory    BOOLEAN DEFAULT true,
  word_limit      INTEGER,
  assigned_to     VARCHAR(255),
  status          VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved')),
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rfp_questions_project ON rfp_questions(project_id);
CREATE INDEX idx_rfp_questions_org ON rfp_questions(organization_id);
CREATE INDEX idx_rfp_questions_assigned_to ON rfp_questions(organization_id, assigned_to);

-- ---------------------------------------------------------------------------
-- RFP answers (AI-drafted and edited answers)
-- ---------------------------------------------------------------------------
CREATE TABLE rfp_answers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      UUID NOT NULL REFERENCES rfp_questions(id) ON DELETE CASCADE,
  organization_id  VARCHAR(255) NOT NULL,
  draft_text       TEXT,
  edited_text      TEXT,
  final_text       TEXT,
  confidence_score FLOAT,
  status           VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'rejected')),
  approved_by      VARCHAR(255),
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rfp_answers_question ON rfp_answers(question_id);
CREATE INDEX idx_rfp_answers_org ON rfp_answers(organization_id);

-- ---------------------------------------------------------------------------
-- RFP answer citations (source citations per answer)
-- ---------------------------------------------------------------------------
CREATE TABLE rfp_answer_citations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id       UUID NOT NULL REFERENCES rfp_answers(id) ON DELETE CASCADE,
  document_id     UUID REFERENCES documents(id) ON DELETE SET NULL,
  chunk_id        UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
  citation_text   TEXT NOT NULL,
  relevance_score FLOAT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rfp_answer_citations_answer ON rfp_answer_citations(answer_id);

-- ---------------------------------------------------------------------------
-- RFP answer comments (review comments)
-- ---------------------------------------------------------------------------
CREATE TABLE rfp_answer_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id       UUID NOT NULL REFERENCES rfp_answers(id) ON DELETE CASCADE,
  organization_id VARCHAR(255) NOT NULL,
  user_id         VARCHAR(255) NOT NULL,
  comment_text    TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rfp_answer_comments_answer ON rfp_answer_comments(answer_id);

-- ---------------------------------------------------------------------------
-- RFP answer history (edit history)
-- ---------------------------------------------------------------------------
CREATE TABLE rfp_answer_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id     UUID NOT NULL REFERENCES rfp_answers(id) ON DELETE CASCADE,
  previous_text TEXT,
  new_text      TEXT NOT NULL,
  edited_by     VARCHAR(255) NOT NULL,
  edited_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rfp_answer_history_answer ON rfp_answer_history(answer_id);

-- ---------------------------------------------------------------------------
-- Subscriptions (billing, multi-tenant)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Invoices (billing, multi-tenant)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Usage records (billing, multi-tenant)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Plan limits (global reference table, no org_id)
-- ---------------------------------------------------------------------------
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

-- Aligned with website pricing: Starter ($299/mo), Growth ($799/mo), Enterprise (Custom)
INSERT INTO plan_limits VALUES
  ('starter',    10,   100,  5,    200,  false, false, true,  true),
  ('growth',     NULL, 500,  20,   500,  true,  true,  true,  true),
  ('enterprise', NULL, NULL, NULL, NULL, true,  true,  true,  true);

-- ---------------------------------------------------------------------------
-- Notifications (multi-tenant)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Notification preferences (multi-tenant)
-- ---------------------------------------------------------------------------
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
-- Answer templates (multi-tenant)
-- ---------------------------------------------------------------------------
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
-- Project outcomes (win/loss tracking, multi-tenant)
-- ---------------------------------------------------------------------------
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
-- Webhook integrations (Slack / Microsoft Teams)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Row Level Security (RLS) for multi-tenant isolation
-- ---------------------------------------------------------------------------

-- Helper function: get current tenant from session variable
CREATE OR REPLACE FUNCTION current_org_id() RETURNS VARCHAR(255) AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_organization_id', true), ''),
    NULL
  );
$$ LANGUAGE SQL STABLE;

-- Enable RLS on all tenant-scoped tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_teams ON teams USING (organization_id = current_org_id());

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tags ON tags USING (organization_id = current_org_id());

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_documents ON documents USING (organization_id = current_org_id());

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_document_chunks ON document_chunks USING (organization_id = current_org_id());

ALTER TABLE document_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tags FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_document_tags ON document_tags USING (organization_id = current_org_id());

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_audit_logs ON audit_logs USING (organization_id = current_org_id());

ALTER TABLE document_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_metrics FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_document_metrics ON document_metrics USING (organization_id = current_org_id());

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_document_versions ON document_versions USING (organization_id = current_org_id());

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_chats ON chats USING (organization_id = current_org_id());

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_projects ON projects USING (organization_id = current_org_id());

ALTER TABLE rfp_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_questions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_rfp_questions ON rfp_questions USING (organization_id = current_org_id());

ALTER TABLE rfp_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_answers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_rfp_answers ON rfp_answers USING (organization_id = current_org_id());

ALTER TABLE rfp_answer_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_answer_comments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_rfp_answer_comments ON rfp_answer_comments USING (organization_id = current_org_id());

-- Join-based policies for tables without organization_id
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_team_members ON team_members
  USING (EXISTS (SELECT 1 FROM teams WHERE teams.id = team_members.team_id AND teams.organization_id = current_org_id()));

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_chat_messages ON chat_messages
  USING (EXISTS (SELECT 1 FROM chats WHERE chats.id = chat_messages.chat_id AND chats.organization_id = current_org_id()));

ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_project_documents ON project_documents
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_documents.project_id AND projects.organization_id = current_org_id()));

ALTER TABLE rfp_answer_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_answer_citations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_rfp_answer_citations ON rfp_answer_citations
  USING (EXISTS (SELECT 1 FROM rfp_answers WHERE rfp_answers.id = rfp_answer_citations.answer_id AND rfp_answers.organization_id = current_org_id()));

ALTER TABLE rfp_answer_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_answer_history FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_rfp_answer_history ON rfp_answer_history
  USING (EXISTS (SELECT 1 FROM rfp_answers WHERE rfp_answers.id = rfp_answer_history.answer_id AND rfp_answers.organization_id = current_org_id()));

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_subscriptions ON subscriptions USING (organization_id = current_org_id());

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_invoices ON invoices USING (organization_id = current_org_id());

ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_usage_records ON usage_records USING (organization_id = current_org_id());

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_notifications ON notifications USING (organization_id = current_org_id());

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_notification_preferences ON notification_preferences USING (organization_id = current_org_id());

ALTER TABLE answer_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE answer_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_answer_templates ON answer_templates USING (organization_id = current_org_id());

ALTER TABLE project_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_outcomes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_project_outcomes ON project_outcomes USING (organization_id = current_org_id());

ALTER TABLE webhook_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_integrations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_webhook_integrations ON webhook_integrations USING (organization_id = current_org_id());
