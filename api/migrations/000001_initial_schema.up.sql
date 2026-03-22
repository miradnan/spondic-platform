-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Organizations (clerk_org_id as primary key)
CREATE TABLE organizations (
  clerk_org_id VARCHAR(255) PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Teams
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

-- Team members
CREATE TABLE team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX idx_team_members_user_id ON team_members(user_id);

-- Tags
CREATE TABLE tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tags_organization_id ON tags(organization_id);

-- Documents (multi-tenant)
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

-- Document chunks (multi-tenant)
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

-- Document tags (multi-tenant)
CREATE TABLE document_tags (
  organization_id VARCHAR(255) NOT NULL,
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id          UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (organization_id, document_id, tag_id)
);

CREATE INDEX idx_document_tags_document_id ON document_tags(document_id);

-- Audit logs (multi-tenant)
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

-- Document metrics (multi-tenant, per-document)
CREATE TABLE document_metrics (
  organization_id   VARCHAR(255) NOT NULL,
  document_id       UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  search_count      BIGINT DEFAULT 0,
  last_accessed_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (organization_id, document_id)
);

-- Document versions (multi-tenant)
CREATE TABLE document_versions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             VARCHAR(255) NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
  document_id                 UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version                     INTEGER NOT NULL,
  previous_embedding_snapshot  JSONB,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (document_id, version)
);

CREATE INDEX idx_document_versions_document_id ON document_versions(document_id);

-- Chats
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

-- Chat messages
CREATE TABLE chat_messages (
  id         BIGSERIAL PRIMARY KEY,
  chat_id    UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role       VARCHAR(20) NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(chat_id, created_at);
