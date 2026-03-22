-- Approval workflow stages per project
CREATE TABLE approval_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id VARCHAR(255) NOT NULL REFERENCES organizations(clerk_org_id),
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  required_role VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_approval_stages_project ON approval_stages(project_id);
CREATE INDEX idx_approval_stages_org ON approval_stages(organization_id);

-- Track which stage each answer is at
CREATE TABLE answer_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID NOT NULL REFERENCES rfp_answers(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES approval_stages(id) ON DELETE CASCADE,
  organization_id VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
  approved_by VARCHAR(255),
  comment TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(answer_id, stage_id)
);

CREATE INDEX idx_answer_approvals_answer ON answer_approvals(answer_id);
CREATE INDEX idx_answer_approvals_stage ON answer_approvals(stage_id);
CREATE INDEX idx_answer_approvals_org ON answer_approvals(organization_id);

-- Row Level Security
ALTER TABLE approval_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_stages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_approval_stages ON approval_stages USING (organization_id = current_org_id());

ALTER TABLE answer_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE answer_approvals FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_answer_approvals ON answer_approvals USING (organization_id = current_org_id());
