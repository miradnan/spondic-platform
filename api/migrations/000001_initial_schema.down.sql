-- Drop tables in reverse order of creation (respecting foreign keys)

DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chats;
DROP TABLE IF EXISTS document_versions;
DROP TABLE IF EXISTS document_metrics;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS document_tags;
DROP TABLE IF EXISTS document_chunks;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS team_members;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS organizations;

-- Extensions are left in place (other objects might use them).
-- To remove: DROP EXTENSION IF EXISTS citext; DROP EXTENSION IF EXISTS pgcrypto;
