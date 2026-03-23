-- Add document_title column to rfp_answer_citations so citations from
-- non-document sources (e.g. approved answers) can carry their own title.
ALTER TABLE rfp_answer_citations
  ADD COLUMN IF NOT EXISTS document_title VARCHAR(500) DEFAULT '';
