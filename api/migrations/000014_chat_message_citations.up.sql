ALTER TABLE chat_messages ADD COLUMN citations JSONB DEFAULT '[]'::jsonb;
