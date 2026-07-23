-- ============================================================
-- add_source_url_migration.sql
-- Adds a column to store the exact page URL a prompt was
-- submitted on, so the extension UI can link back to the
-- original conversation on the AI platform ("Open Original"
-- button on History / Dashboard cards).
--
-- Safe to run multiple times (IF NOT EXISTS guard).
-- Existing rows will simply have source_url = NULL — the
-- extension UI falls back to the platform's homepage for those.
-- ============================================================

ALTER TABLE searches
  ADD COLUMN IF NOT EXISTS source_url TEXT;
