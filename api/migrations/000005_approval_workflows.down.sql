DROP POLICY IF EXISTS tenant_isolation_answer_approvals ON answer_approvals;
DROP POLICY IF EXISTS tenant_isolation_approval_stages ON approval_stages;

DROP TABLE IF EXISTS answer_approvals;
DROP TABLE IF EXISTS approval_stages;
