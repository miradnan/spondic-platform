DROP POLICY IF EXISTS tenant_isolation_org_branding ON org_branding;
ALTER TABLE org_branding DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS org_branding;
