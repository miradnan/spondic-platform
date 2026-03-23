-- Add activity tracking to rfp_answer_history
-- action: drafted, edited, approved, rejected, commented, redrafted, status_changed
ALTER TABLE rfp_answer_history
  ADD COLUMN action VARCHAR(50) DEFAULT 'edited',
  ALTER COLUMN new_text DROP NOT NULL;

-- Backfill existing rows
UPDATE rfp_answer_history SET action = 'edited' WHERE action IS NULL;

-- Index for querying activity by answer
CREATE INDEX idx_rfp_answer_history_edited_at ON rfp_answer_history(answer_id, edited_at DESC);
