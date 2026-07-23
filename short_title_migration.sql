-- ============================================================
-- Migration: Add original_query column for short title feature
-- Run this in your Supabase SQL Editor before deploying the update.
--
-- What it does:
--   - Adds an `original_query` TEXT column to the searches table.
--     This stores the full original prompt the user typed.
--     The existing `query` column will now hold the short AI-generated title.
--
-- For existing rows:
--   - Copies the current `query` value into `original_query` so no data is lost.
-- ============================================================

-- Step 1: Add the new column
ALTER TABLE searches ADD COLUMN IF NOT EXISTS original_query TEXT;

-- Step 2: Back-fill existing rows so original_query = query (preserves old full prompts)
UPDATE searches
SET original_query = query
WHERE original_query IS NULL;
