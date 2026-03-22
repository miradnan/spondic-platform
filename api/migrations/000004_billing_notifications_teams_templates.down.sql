-- ============================================================================
-- Reverse migration 004: Drop billing, notifications, templates, outcomes
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Drop RLS policies on new tables
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation_subscriptions ON subscriptions;
DROP POLICY IF EXISTS tenant_isolation_invoices ON invoices;
DROP POLICY IF EXISTS tenant_isolation_usage_records ON usage_records;
DROP POLICY IF EXISTS tenant_isolation_notifications ON notifications;
DROP POLICY IF EXISTS tenant_isolation_notification_preferences ON notification_preferences;
DROP POLICY IF EXISTS tenant_isolation_answer_templates ON answer_templates;
DROP POLICY IF EXISTS tenant_isolation_project_outcomes ON project_outcomes;

-- ---------------------------------------------------------------------------
-- 2. Disable RLS on new tables
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usage_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notification_preferences DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS answer_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_outcomes DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. Drop indexes on altered existing tables
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_rfp_questions_assigned_to;
DROP INDEX IF EXISTS idx_projects_team_id;

-- ---------------------------------------------------------------------------
-- 4. Revert ALTER TABLE changes on existing tables
-- ---------------------------------------------------------------------------
ALTER TABLE rfp_questions DROP COLUMN IF EXISTS assigned_to;
ALTER TABLE projects DROP COLUMN IF EXISTS team_id;

-- ---------------------------------------------------------------------------
-- 5. Drop new tables in reverse dependency order
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS project_outcomes;
DROP TABLE IF EXISTS answer_templates;
DROP TABLE IF EXISTS notification_preferences;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS plan_limits;
DROP TABLE IF EXISTS usage_records;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS subscriptions;
