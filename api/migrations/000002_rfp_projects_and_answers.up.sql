-- Projects (RFP projects, multi-tenant)
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR(255) NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  deadline        TIMESTAMPTZ,
  status          VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'submitted')),
  created_by      VARCHAR(255) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_projects_status ON projects(organization_id, status);

-- Project documents (link RFP files to projects)
CREATE TABLE project_documents (
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, document_id)
);

-- RFP questions (extracted from RFP documents)
CREATE TABLE rfp_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id VARCHAR(255) NOT NULL,
  question_text   TEXT NOT NULL,
  section         TEXT,
  question_number INTEGER,
  is_mandatory    BOOLEAN DEFAULT true,
  word_limit      INTEGER,
  status          VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved')),
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rfp_questions_project ON rfp_questions(project_id);
CREATE INDEX idx_rfp_questions_org ON rfp_questions(organization_id);

-- RFP answers (AI-drafted and edited answers)
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

-- RFP answer citations (source citations per answer)
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

-- RFP answer comments (review comments)
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

-- RFP answer history (edit history)
CREATE TABLE rfp_answer_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id     UUID NOT NULL REFERENCES rfp_answers(id) ON DELETE CASCADE,
  previous_text TEXT,
  new_text      TEXT NOT NULL,
  edited_by     VARCHAR(255) NOT NULL,
  edited_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rfp_answer_history_answer ON rfp_answer_history(answer_id);
