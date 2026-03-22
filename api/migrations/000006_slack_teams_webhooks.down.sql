DROP POLICY IF EXISTS tenant_isolation_webhook_integrations ON webhook_integrations;
ALTER TABLE webhook_integrations DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS webhook_integrations;
