-- Remove stripe_subscription_item_id from subscriptions
ALTER TABLE subscriptions DROP COLUMN IF EXISTS stripe_subscription_item_id;
