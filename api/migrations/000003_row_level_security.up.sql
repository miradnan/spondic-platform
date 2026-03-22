-- ============================================================================
-- Row Level Security (RLS) for multi-tenant isolation
--
-- This migration enables RLS on all tenant-scoped tables. Every query is
-- automatically filtered by organization_id using the session variable
-- app.current_organization_id, which the Go API sets per-request.
--
-- This is a SAFETY NET on top of application-level WHERE clauses. Even if
-- a developer forgets to filter by org_id, RLS blocks cross-tenant access.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Helper function to get the current tenant ID from session variable
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_org_id() RETURNS VARCHAR(255) AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_organization_id', true), ''),
    NULL
  );
$$ LANGUAGE SQL STABLE;

-- ---------------------------------------------------------------------------
-- 2. Create app_user role (the role the Go API connects as)
--    Skip if it already exists.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN;
  END IF;
END
$$;

-- Grant necessary privileges to app_user
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Also grant on future tables/sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- ---------------------------------------------------------------------------
-- 3. Enable RLS and create policies on all tenant-scoped tables
-- ---------------------------------------------------------------------------

-- ── teams ──────────────────────────────────────────────────────────────────
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_teams ON teams
  USING (organization_id = current_org_id());

-- ── tags ───────────────────────────────────────────────────────────────────
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tags ON tags
  USING (organization_id = current_org_id());

-- ── documents ──────────────────────────────────────────────────────────────
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_documents ON documents
  USING (organization_id = current_org_id());

-- ── document_chunks ────────────────────────────────────────────────────────
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_document_chunks ON document_chunks
  USING (organization_id = current_org_id());

-- ── document_tags ──────────────────────────────────────────────────────────
ALTER TABLE document_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tags FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_document_tags ON document_tags
  USING (organization_id = current_org_id());

-- ── audit_logs ─────────────────────────────────────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  USING (organization_id = current_org_id());

-- ── document_metrics ───────────────────────────────────────────────────────
ALTER TABLE document_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_metrics FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_document_metrics ON document_metrics
  USING (organization_id = current_org_id());

-- ── document_versions ──────────────────────────────────────────────────────
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_document_versions ON document_versions
  USING (organization_id = current_org_id());

-- ── chats ──────────────────────────────────────────────────────────────────
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_chats ON chats
  USING (organization_id = current_org_id());

-- ── projects ───────────────────────────────────────────────────────────────
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_projects ON projects
  USING (organization_id = current_org_id());

-- ── rfp_questions ──────────────────────────────────────────────────────────
ALTER TABLE rfp_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_questions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_rfp_questions ON rfp_questions
  USING (organization_id = current_org_id());

-- ── rfp_answers ────────────────────────────────────────────────────────────
ALTER TABLE rfp_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_answers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_rfp_answers ON rfp_answers
  USING (organization_id = current_org_id());

-- ── rfp_answer_comments ────────────────────────────────────────────────────
ALTER TABLE rfp_answer_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_answer_comments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_rfp_answer_comments ON rfp_answer_comments
  USING (organization_id = current_org_id());

-- ---------------------------------------------------------------------------
-- 4. Tables WITHOUT organization_id — use JOIN-based policies
-- ---------------------------------------------------------------------------

-- ── team_members (org_id lives on parent teams table) ──────────────────────
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_team_members ON team_members
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_members.team_id
        AND teams.organization_id = current_org_id()
    )
  );

-- ── chat_messages (org_id lives on parent chats table) ─────────────────────
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_chat_messages ON chat_messages
  USING (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_messages.chat_id
        AND chats.organization_id = current_org_id()
    )
  );

-- ── project_documents (org_id lives on parent projects table) ──────────────
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_project_documents ON project_documents
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_documents.project_id
        AND projects.organization_id = current_org_id()
    )
  );

-- ── rfp_answer_citations (no org_id — accessed via answer → question) ──────
ALTER TABLE rfp_answer_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_answer_citations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_rfp_answer_citations ON rfp_answer_citations
  USING (
    EXISTS (
      SELECT 1 FROM rfp_answers
      WHERE rfp_answers.id = rfp_answer_citations.answer_id
        AND rfp_answers.organization_id = current_org_id()
    )
  );

-- ── rfp_answer_history (no org_id — accessed via answer) ───────────────────
ALTER TABLE rfp_answer_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_answer_history FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_rfp_answer_history ON rfp_answer_history
  USING (
    EXISTS (
      SELECT 1 FROM rfp_answers
      WHERE rfp_answers.id = rfp_answer_history.answer_id
        AND rfp_answers.organization_id = current_org_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. organizations table — no RLS (it IS the tenant registry)
--    Superadmin / migration user needs unrestricted access to it.
--    The app only queries it to upsert the current org anyway.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 6. Bypass policy for superuser / migration role
--    The postgres superuser already bypasses RLS by default.
--    If you run migrations as a different role, grant BYPASSRLS to it.
-- ---------------------------------------------------------------------------
