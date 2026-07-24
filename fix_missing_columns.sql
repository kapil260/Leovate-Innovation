-- ============================================================
-- Recall AI — fix_missing_columns.sql
-- Adds the two columns Supabase is currently rejecting:
--   - original_query  (full prompt text, separate from the
--                       AI-shortened title stored in `query`)
--   - source_url       (exact chat URL, powers "Open Original
--                       Conversation")
--
-- Safe to run multiple times (IF NOT EXISTS guards).
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run.
-- ============================================================

-- 1. original_query — full original prompt (see short_title_migration.sql)
ALTER TABLE searches ADD COLUMN IF NOT EXISTS original_query TEXT;

-- Back-fill existing rows so nothing looks empty for old entries
UPDATE searches
SET original_query = query
WHERE original_query IS NULL;

-- 2. source_url — exact page URL a prompt was submitted on
--    (see add_source_url_migration.sql)
ALTER TABLE searches ADD COLUMN IF NOT EXISTS source_url TEXT;

-- 3. Force PostgREST to pick up the new columns immediately instead
--    of waiting for its next automatic schema-cache refresh.
NOTIFY pgrst, 'reload schema';
