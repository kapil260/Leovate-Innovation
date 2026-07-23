-- ============================================================
-- Recall AI — Migration SQL
-- Safe to run multiple times
-- ============================================================

ALTER TABLE searches
ADD COLUMN IF NOT EXISTS response_text TEXT NOT NULL DEFAULT '';

ALTER TABLE searches
ADD COLUMN IF NOT EXISTS combined_summary TEXT NOT NULL DEFAULT '';

ALTER TABLE searches
ADD COLUMN IF NOT EXISTS content TEXT;