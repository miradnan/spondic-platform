-- Add ai_tokens_used metric to usage_records
ALTER TABLE usage_records DROP CONSTRAINT IF EXISTS usage_records_metric_check;
ALTER TABLE usage_records ADD CONSTRAINT usage_records_metric_check
  CHECK (metric IN ('rfps_processed', 'documents_uploaded', 'questions_drafted', 'users', 'ai_tokens_used'));

-- Add token limit to plan_limits
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS max_tokens_per_month BIGINT;

-- Update plan limits with token quotas
UPDATE plan_limits SET max_tokens_per_month = 100000   WHERE plan = 'free';
UPDATE plan_limits SET max_tokens_per_month = 1000000  WHERE plan = 'starter';
UPDATE plan_limits SET max_tokens_per_month = 5000000  WHERE plan = 'growth';
UPDATE plan_limits SET max_tokens_per_month = NULL      WHERE plan = 'enterprise';  -- unlimited
