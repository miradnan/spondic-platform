DROP INDEX IF EXISTS idx_rfp_answer_history_edited_at;

ALTER TABLE rfp_answer_history
  DROP COLUMN IF EXISTS action;

-- Restore NOT NULL (remove rows with null new_text first)
DELETE FROM rfp_answer_history WHERE new_text IS NULL;
ALTER TABLE rfp_answer_history ALTER COLUMN new_text SET NOT NULL;
