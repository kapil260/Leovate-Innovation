-- ============================================================
-- Supabase Migration: Create password_resets table
-- This table is REQUIRED for the forgot-security-key flow.
-- The verify-otp route writes a short-lived token here,
-- and reset-password reads from it to authorize the change.
--
-- Run in: Supabase → SQL Editor → New Query → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.password_resets (
  id          bigint       PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id     bigint       NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  token       text         NOT NULL,          -- SHA-256 hash of the raw reset token
  expires_at  timestamptz  NOT NULL,          -- 5 minutes from creation
  used        boolean      NOT NULL DEFAULT false,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON public.password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_token   ON public.password_resets(token);

ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_only" ON public.password_resets;
CREATE POLICY "service_only" ON public.password_resets
  USING (false)
  WITH CHECK (false);

-- ✅ Done! Also make sure otp_resets exists (from OTP Reset Tracking.sql)