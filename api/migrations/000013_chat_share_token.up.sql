ALTER TABLE chats ADD COLUMN share_token UUID UNIQUE;
CREATE INDEX idx_chats_share_token ON chats (share_token) WHERE share_token IS NOT NULL;
