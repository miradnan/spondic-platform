-- Add stripe_subscription_item_id to subscriptions for metered billing
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_item_id VARCHAR(255);
