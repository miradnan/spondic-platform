store this in postgres

organizations (clerk_org_id)

teams
  - id
  - organization_id (clerk_org_id)
  - name
  - created_at timestamp with timezone
  - updated_at timestamp with timezone
  - deleted_at timestamp with timezone
  
  in UI we should give admin option to select and create teams from below default teams.
   - Procurement team
   - Technical Team
   - Finance team
   - Legal Protection
   - Business Team
   - Risk Management team

team_members
  - team_id
  - user_id (clerk_user_id)


Documents (Multi tenant Collection)
    - id UUID PRIMARY KEY
    - weaviate_object_id  UUID                -- maps to Weaviate object
    - organization_id     VARCHAR(255)        -- clerk_org_id
    - uploaded_by_user_id VARCHAR(255)        -- clerk_user_id
    - title               TEXT
    - description         TEXT
    - source_type         VARCHAR(50)         -- pdf, url, text, api
    - source_url          TEXT
    - file_name           TEXT
    - file_size_bytes     BIGINT
    - content_hash        VARCHAR(255)        -- for deduplication
    - version             INTEGER DEFAULT 1
    - status              VARCHAR(50)         -- processing, ready, failed
    - created_at          TIMESTAMP with timezone
    - updated_at          TIMESTAMP with timezone
    - deleted_at          TIMESTAMP NULL with timezone

document_chunks (Multi tenant Collection)
 - id                  UUID PRIMARY KEY
 - document_id         UUID REFERENCES documents(id)
 - weaviate_object_id  UUID
 - organization_id     VARCHAR(255)        -- clerk_org_id
 - chunk_index         INTEGER DEFAULT 0
 - token_count         INTEGER DEFAULT 0
 - embedding_model     VARCHAR(100) DEFAULT NULL
 - created_at          TIMESTAMP with timezone
 - deleted_at          TIMESTAMP NULL     with timezone

document_tags
 - organization_id     VARCHAR(255)        -- clerk_org_id
 - document_id BIGINT REFERENCES documents(id)
 - tag_id      BIGINT REFERENCES tags(id)
 - created_at  TIMESTAMP with timezone
 PRIMARY KEY (organization_id, document_id, tag_id)

audit_logs 
 - id                  BIGSERIAL PRIMARY KEY
 - organization_id     VARCHAR(255) NOT NULL -- clerk_org_id
 - user_id             VARCHAR(255) NOT NULL -- clerk_user_id
 - action              VARCHAR(100) NOT NULL
 - entity_type         VARCHAR(100)  -- document, tag, team
 - entity_id           VARCHAR(255)
 - metadata            JSONB
 - ip_address          VARCHAR(100)
 - user_agent          TEXT
 - created_at          TIMESTAMP DEFAULT NOW() with timezone
CREATE INDEX idx_audit_org_created
ON audit_logs (organization_id, created_at DESC);

document_metrics 
    - organization_id     VARCHAR(255)        -- clerk_org_id
    - search_count
    - last_accessed_at timestamp with timezone

document_versions
    - organization_id     VARCHAR(255)        -- clerk_org_id
    - version number
    - previous embedding snapshot

chats 
    - id UUID
    - organization_id     VARCHAR(255) NOT NULL -- clerk_org_id
    - user_id             VARCHAR(255) NOT NULL -- clerk_user_id
    - title               CITEXT
    - created_at          TIMESTAMP with timezone
    - updated_at          TIMESTAMP with timezone
    - deleted_at          TIMESTAMP NULL with timezone

chat_messages
 - chat_id references chats(id)
 - message
 - created_at TIMESTAMP with timezone


In Weaviate store
Documents Collection (Multi Tenant)