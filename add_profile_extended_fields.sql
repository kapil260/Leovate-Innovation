-- ============================================================
-- RECALL AI — Add missing Profile fields
-- Run this in: Supabase → SQL Editor → New Query
-- This is why "Save Changes" on the Profile page was not working:
-- the backend reads/writes these columns, but they never
-- existed on the `profiles` table.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone        TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS bio          TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS location     TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS display_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS timezone     TEXT DEFAULT 'asia/kathmandu',
  ADD COLUMN IF NOT EXISTS language     TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS github       TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS twitter      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS linkedin     TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS website      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS avatar_url   TEXT DEFAULT '';
