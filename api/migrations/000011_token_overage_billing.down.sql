ALTER TABLE plan_limits DROP COLUMN IF EXISTS overage_rate_cents_per_1k;

DELETE FROM usage_records WHERE metric = 'ai_tokens_overage';

ALTER TABLE usage_records DROP CONSTRAINT IF EXISTS usage_records_metric_check;
ALTER TABLE usage_records ADD CONSTRAINT usage_records_metric_check
  CHECK (metric IN ('rfps_processed', 'documents_uploaded', 'questions_drafted', 'users', 'ai_tokens_used'));
