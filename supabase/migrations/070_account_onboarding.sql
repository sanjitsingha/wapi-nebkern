-- ============================================================
-- 070_account_onboarding.sql — one-time plan-selection gate
--
-- Every new account already starts on a 14-day trial (migration 051).
-- This adds the flag that lets the app force a NEW account owner through
-- a one-time plan-selection screen (/onboarding) BEFORE they reach the
-- app: start the free trial, or subscribe now.
--
--   onboarded_at NULL  -> owner hasn't chosen yet -> gate to /onboarding
--   onboarded_at set   -> choice made (trial started, or a plan was paid)
--
-- Nothing here BLOCKS — enforcement lives in the app (src/middleware.ts).
-- The flag is stamped by:
--   * POST /api/account/onboarding/start-trial  (chose the free trial)
--   * POST /api/billing/razorpay/verify         (paid for a plan)
--
-- Grandfathering: the column is added WITH a DEFAULT of now(), which
-- stamps every account that already exists in one shot, then the default
-- is dropped. New rows created by handle_new_user() (migration 051) don't
-- set onboarded_at, so with no default they land NULL and are gated —
-- exactly the accounts that just registered.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS is a no-op on a re-run (so existing
-- onboarded_at values are never re-stamped), and DROP DEFAULT on an
-- already-defaultless column is harmless.
-- ============================================================

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz DEFAULT now();

ALTER TABLE accounts
  ALTER COLUMN onboarded_at DROP DEFAULT;
