DROP INDEX IF EXISTS idx_chats_share_token;
ALTER TABLE chats DROP COLUMN IF EXISTS share_token;
