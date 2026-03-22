-- Reverse RLS migration: disable RLS and drop policies

-- Drop all tenant isolation policies
DROP POLICY IF EXISTS tenant_isolation_teams ON teams;
DROP POLICY IF EXISTS tenant_isolation_tags ON tags;
DROP POLICY IF EXISTS tenant_isolation_documents ON documents;
DROP POLICY IF EXISTS tenant_isolation_document_chunks ON document_chunks;
DROP POLICY IF EXISTS tenant_isolation_document_tags ON document_tags;
DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;
DROP POLICY IF EXISTS tenant_isolation_document_metrics ON document_metrics;
DROP POLICY IF EXISTS tenant_isolation_document_versions ON document_versions;
DROP POLICY IF EXISTS tenant_isolation_chats ON chats;
DROP POLICY IF EXISTS tenant_isolation_projects ON projects;
DROP POLICY IF EXISTS tenant_isolation_rfp_questions ON rfp_questions;
DROP POLICY IF EXISTS tenant_isolation_rfp_answers ON rfp_answers;
DROP POLICY IF EXISTS tenant_isolation_rfp_answer_comments ON rfp_answer_comments;
DROP POLICY IF EXISTS tenant_isolation_team_members ON team_members;
DROP POLICY IF EXISTS tenant_isolation_chat_messages ON chat_messages;
DROP POLICY IF EXISTS tenant_isolation_project_documents ON project_documents;
DROP POLICY IF EXISTS tenant_isolation_rfp_answer_citations ON rfp_answer_citations;
DROP POLICY IF EXISTS tenant_isolation_rfp_answer_history ON rfp_answer_history;

-- Disable RLS on all tables
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_answers DISABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_answer_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_answer_citations DISABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_answer_history DISABLE ROW LEVEL SECURITY;

-- Drop helper function
DROP FUNCTION IF EXISTS current_org_id();
