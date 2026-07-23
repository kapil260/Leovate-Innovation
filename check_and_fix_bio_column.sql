-- ============================================================
-- STEP 1 — Check if `bio` (and the other extended fields) actually
-- exist on the `profiles` table right now.
-- Run this first and look at the result.
-- ============================================================
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY column_name;

-- ============================================================
-- STEP 2 — If 'bio' is missing from the result above, add all the
-- extended profile columns again (safe to re-run, uses IF NOT EXISTS).
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

-- ============================================================
-- STEP 3 — Force Supabase's PostgREST API layer to reload its
-- schema cache. This is the step that's most often skipped:
-- even after a column is added successfully, the API can keep
-- using a stale cached schema for a little while until this runs
-- (or until Supabase auto-refreshes it, which can take a bit).
-- ============================================================
NOTIFY pgrst, 'reload schema';
