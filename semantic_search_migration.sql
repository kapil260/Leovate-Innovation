-- ============================================================
-- semantic_search_migration.sql
-- Adds a column to store AI embedding vectors on each search, so
-- Recall AI can support Semantic Search (find results by meaning,
-- not just exact keywords).
--
-- We store the embedding as JSONB (a plain array of numbers) rather
-- than using the Postgres `vector` type from pgvector, so this works
-- on any Supabase project with zero extra setup — no need to enable
-- the pgvector extension first.
--
-- Run this once in the Supabase SQL editor.
-- ============================================================

ALTER TABLE searches
  ADD COLUMN IF NOT EXISTS embedding JSONB;

-- Optional but recommended: speeds up "give me all rows that still
-- need an embedding" queries used by the one-time backfill endpoint
-- (POST /api/searches/embed-all).
CREATE INDEX IF NOT EXISTS idx_searches_embedding_null
  ON searches ((embedding IS NULL))
  WHERE embedding IS NULL;
