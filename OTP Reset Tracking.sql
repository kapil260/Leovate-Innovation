-- ============================================================
-- Supabase Migration: Create otp_resets table
-- Run this in: Supabase → SQL Editor → New Query → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.otp_resets (
  id          bigint       PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id     bigint       NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  otp_hash    text         NOT NULL,
  expires_at  timestamptz  NOT NULL,
  verified    boolean      NOT NULL DEFAULT false,
  attempts    integer      NOT NULL DEFAULT 0,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_resets_user_id ON public.otp_resets(user_id);

ALTER TABLE public.otp_resets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_only" ON public.otp_resets;
CREATE POLICY "service_only" ON public.otp_resets
  USING (false)
  WITH CHECK (false);

-- ✅ Done!

