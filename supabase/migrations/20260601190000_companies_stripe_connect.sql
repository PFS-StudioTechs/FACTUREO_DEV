-- Phase 1-BIS: Stripe Connect fields on companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS stripe_account_id text NULL,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_done boolean NOT NULL DEFAULT false;
