-- ============================================================
-- RECALL AI v2 — Additional Tables for Missing Features
-- Run AFTER the original recallai-supabase.sql
-- Adds: password_resets, email_verifications, user_settings,
--       subscriptions, offline_queue, email_verified column
-- ============================================================


-- ── ADD email_verified TO profiles ───────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;


-- ── PASSWORD RESETS TABLE ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_resets (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,              -- SHA-256 hashed token
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_user  ON password_resets(user_id);


-- ── EMAIL VERIFICATIONS TABLE ─────────────────────────────────
CREATE TABLE IF NOT EXISTS email_verifications (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,              -- SHA-256 hashed token
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_email_verif_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verif_user  ON email_verifications(user_id);


-- ── USER SETTINGS TABLE ───────────────────────────────────────
-- Stores all user preferences as a JSON blob
CREATE TABLE IF NOT EXISTS user_settings (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  data        JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);


-- ── SUBSCRIPTIONS TABLE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan             TEXT NOT NULL DEFAULT 'free',   -- free | pro | team
  status           TEXT NOT NULL DEFAULT 'active', -- active | cancelled | past_due
  searches_limit   INTEGER NOT NULL DEFAULT 100,
  searches_used    INTEGER NOT NULL DEFAULT 0,
  features         JSONB NOT NULL DEFAULT '[]',
  renews_at        TIMESTAMPTZ,
  upgraded_at      TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  stripe_customer  TEXT,      -- for future Stripe integration
  stripe_sub_id    TEXT,      -- for future Stripe integration
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);


-- ── OFFLINE QUEUE TABLE ───────────────────────────────────────
-- Stores searches captured when backend was unreachable
CREATE TABLE IF NOT EXISTS offline_queue (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  query       TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'ChatGPT',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced      BOOLEAN NOT NULL DEFAULT FALSE,
  synced_at   TIMESTAMPTZ,
  error_msg   TEXT
);
CREATE INDEX IF NOT EXISTS idx_offline_queue_user   ON offline_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_queue_synced ON offline_queue(synced);


-- ── DISABLE RLS ───────────────────────────────────────────────
ALTER TABLE password_resets     DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings       DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions       DISABLE ROW LEVEL SECURITY;
ALTER TABLE offline_queue       DISABLE ROW LEVEL SECURITY;


-- ── VERIFY ───────────────────────────────────────────────────
SELECT 'password_resets table ready ✅'     AS status;
SELECT 'email_verifications table ready ✅' AS status;
SELECT 'user_settings table ready ✅'       AS status;
SELECT 'subscriptions table ready ✅'       AS status;
SELECT 'offline_queue table ready ✅'       AS status;
SELECT 'email_verified column added ✅'     AS status;
