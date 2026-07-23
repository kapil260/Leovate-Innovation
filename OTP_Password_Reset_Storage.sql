-- ============================================================
-- Recall AI — OTP Reset Tables Migration
-- Run this in Supabase SQL Editor
-- Creates the otp_resets table needed for forgot password
-- ============================================================

-- Table to store OTP codes for password reset
CREATE TABLE IF NOT EXISTS otp_resets (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  otp_hash    TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  verified    BOOLEAN NOT NULL DEFAULT FALSE,
  attempts    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Table to store reset tokens (after OTP verified)
CREATE TABLE IF NOT EXISTS password_resets (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Disable RLS so backend can read/write freely
ALTER TABLE otp_resets     DISABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets DISABLE ROW LEVEL SECURITY;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_otp_resets_user    ON otp_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);

-- Confirm
SELECT 'otp_resets table ready ✅' AS status
UNION ALL
SELECT 'password_resets table ready ✅' AS status;
