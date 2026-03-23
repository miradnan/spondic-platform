-- Remove token limit from plan_limits
ALTER TABLE plan_limits DROP COLUMN IF EXISTS max_tokens_per_month;

-- Restore original metric check
ALTER TABLE usage_records DROP CONSTRAINT IF EXISTS usage_records_metric_check;
ALTER TABLE usage_records ADD CONSTRAINT usage_records_metric_check
  CHECK (metric IN ('rfps_processed', 'documents_uploaded', 'questions_drafted', 'users'));

-- Remove ai_tokens_used records
DELETE FROM usage_records WHERE metric = 'ai_tokens_used';
