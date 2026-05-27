-- ============================================================
-- Recall AI — Migration SQL
-- Run this ONCE in Supabase SQL Editor
-- Adds response_text and combined_summary columns
-- ============================================================

ALTER TABLE searches ADD COLUMN IF NOT EXISTS response_text    TEXT NOT NULL DEFAULT '';
ALTER TABLE searches ADD COLUMN IF NOT EXISTS combined_summary TEXT NOT NULL DEFAULT '';
ALTER TABLE searches ADD COLUMN content TEXT;