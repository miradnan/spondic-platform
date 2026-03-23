-- Add overage billing rate to plan_limits
-- Rate is in cents per 1,000 tokens. NULL = no overage allowed (hard block).
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS overage_rate_cents_per_1k INTEGER;

UPDATE plan_limits SET overage_rate_cents_per_1k = NULL WHERE plan = 'free';       -- hard block, no overage
UPDATE plan_limits SET overage_rate_cents_per_1k = 50   WHERE plan = 'starter';    -- $0.50 / 1K tokens
UPDATE plan_limits SET overage_rate_cents_per_1k = 30   WHERE plan = 'growth';     -- $0.30 / 1K tokens
UPDATE plan_limits SET overage_rate_cents_per_1k = 20   WHERE plan = 'enterprise'; -- $0.20 / 1K tokens

-- Track overage tokens separately from included allowance
-- Reuse usage_records with a new metric
ALTER TABLE usage_records DROP CONSTRAINT IF EXISTS usage_records_metric_check;
ALTER TABLE usage_records ADD CONSTRAINT usage_records_metric_check
  CHECK (metric IN ('rfps_processed', 'documents_uploaded', 'questions_drafted', 'users', 'ai_tokens_used', 'ai_tokens_overage'));
