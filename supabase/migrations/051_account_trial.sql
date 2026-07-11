-- ============================================================
-- 051_account_trial.sql — 14-day free trial on every account
--
-- Adds subscription/trial state to `accounts` (one subscription per
-- tenant, the unit everything is already scoped to). This pass covers
-- the FREE TRIAL only — paid plans and payment-provider linkage are
-- documented in docs/billing-and-trial.md and added later.
--
-- What this does
--   1. subscription_status_enum lifecycle type.
--   2. Four columns on accounts: plan, subscription_status,
--      trial_started_at, trial_ends_at.
--   3. Backfills EXISTING accounts to 'active' (grandfathered) so
--      current users/dev accounts are never trapped in an expired trial.
--   4. Replaces handle_new_user() so NEW signups start a 14-day trial
--      atomically with account creation.
--
-- Effective state is computed on read (see src/lib/billing/subscription.ts):
-- a 'trialing' row past trial_ends_at is treated as expired without needing
-- a cron. No enforcement lives in the DB — the app layer gates on it.
--
-- Idempotent: enum guarded by pg_type check; columns use IF NOT EXISTS;
-- the trigger/function are DROP-then-CREATE.
-- ============================================================

-- ---- (1) lifecycle enum ------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status_enum') THEN
    CREATE TYPE subscription_status_enum AS ENUM (
      'trialing',   -- inside the free-trial window
      'active',     -- paid & current (also: grandfathered accounts)
      'past_due',   -- payment failed, grace period (paid plans, later)
      'canceled',   -- canceled; access until period end (later)
      'expired'     -- trial/subscription lapsed with no active plan
    );
  END IF;
END $$;

-- ---- (2) columns on accounts -------------------------------
-- Defaults describe a NEW trialing account; the trigger sets the trial
-- dates explicitly. Existing rows get the defaults from this ADD COLUMN,
-- then step (3) overrides them to grandfather.
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS plan                TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS subscription_status subscription_status_enum NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS trial_started_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at       TIMESTAMPTZ;

-- ---- (3) grandfather existing accounts ---------------------
-- Only touch rows that predate this migration: a fresh trialing row with
-- no trial dates set is an existing account (the trigger always sets
-- trial dates going forward). Guard on trial_started_at IS NULL so a
-- re-run doesn't re-stamp accounts created after this deployed.
UPDATE accounts
SET plan = 'grandfathered',
    subscription_status = 'active'
WHERE trial_started_at IS NULL
  AND subscription_status = 'trialing';

-- ---- (4) signup trigger: start the trial -------------------
-- Replaces the 017 version. Same account+profile bootstrap, now also
-- stamping a 14-day trial on the new account. Trial length is inlined
-- here and mirrored by TRIAL_DAYS in src/lib/billing/subscription.ts —
-- keep them in sync if it changes.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_account_id UUID;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.accounts (
    name, owner_user_id,
    plan, subscription_status, trial_started_at, trial_ends_at
  )
  VALUES (
    COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'), NEW.id,
    'trial', 'trialing', NOW(), NOW() + INTERVAL '14 days'
  )
  RETURNING id INTO v_account_id;

  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
