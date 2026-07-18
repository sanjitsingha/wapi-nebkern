-- ============================================================
-- 054_billing.sql — admin-managed pricing + per-account billing
--
-- First billing pass: PRICING + SUBSCRIPTION management (manual). No
-- payment provider yet — the admin sets an account's plan, price, billing
-- interval, and current period by hand. Razorpay linkage comes later; the
-- columns here (amount in minor units, currency, interval, period window)
-- are shaped to map cleanly onto a provider subscription when it lands.
--
-- What this adds
--   1. billing_plans — the priced plan catalog, editable from the admin
--      panel (so pricing changes need no redeploy). Keyed by a stable
--      plan key that mirrors src/lib/billing/plans.ts.
--   2. Six columns on accounts describing the account's CURRENT billing:
--      chosen plan key, agreed amount (snapshot, so later price changes
--      don't silently re-bill existing accounts), currency, interval, and
--      the current period start/end.
--
-- Money is stored in MINOR UNITS (paise/cents) as an integer — never
-- floats — so totals are exact.
--
-- RLS
--   billing_plans: any authenticated user may read ACTIVE plans (the app's
--   pricing page can show them); only the service role writes (the admin
--   panel uses the service-role client, which bypasses RLS). The account
--   billing columns live on `accounts`, which already has its own RLS.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ---- (1) plan catalog --------------------------------------
CREATE TABLE IF NOT EXISTS billing_plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,          -- 'starter' | 'pro' | 'business' | …
  name        text NOT NULL,
  description text,
  amount      integer NOT NULL DEFAULT 0     -- minor units (e.g. paise)
                CHECK (amount >= 0),
  currency    text NOT NULL DEFAULT 'INR',
  interval    text NOT NULL DEFAULT 'monthly'
                CHECK (interval IN ('monthly', 'yearly')),
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE billing_plans ENABLE ROW LEVEL SECURITY;

-- Any signed-in user may read active plans (pricing display). Writes have
-- no policy, so they're denied under RLS — only the service-role admin
-- client (which bypasses RLS) can change pricing.
DROP POLICY IF EXISTS billing_plans_select ON billing_plans;
CREATE POLICY billing_plans_select ON billing_plans FOR SELECT
  USING (is_active OR auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.update_billing_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS billing_plans_updated_at ON billing_plans;
CREATE TRIGGER billing_plans_updated_at
  BEFORE UPDATE ON billing_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_billing_plans_updated_at();

-- Seed the three tiers (mirrors src/lib/billing/plans.ts). Placeholder
-- INR pricing — edit it from Admin → Plans. ON CONFLICT DO NOTHING so a
-- re-run never clobbers prices the operator has since edited.
INSERT INTO billing_plans (key, name, description, amount, currency, interval, sort_order)
VALUES
  ('starter',  'Starter',  'For getting started on WhatsApp',  49900, 'INR', 'monthly', 1),
  ('pro',      'Pro',      'For growing teams',                99900, 'INR', 'monthly', 2),
  ('business', 'Business', 'For scale',                       249900, 'INR', 'monthly', 3)
ON CONFLICT (key) DO NOTHING;

-- ---- (2) per-account billing columns -----------------------
-- The account's CURRENT billing arrangement. `billing_amount` is a
-- snapshot of the agreed price at assignment time (independent of later
-- catalog edits). All nullable — an account on trial / grandfathered has
-- no paid billing set.
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS billing_plan_key      text,
  ADD COLUMN IF NOT EXISTS billing_amount        integer CHECK (billing_amount IS NULL OR billing_amount >= 0),
  ADD COLUMN IF NOT EXISTS billing_currency      text NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS billing_interval      text CHECK (billing_interval IS NULL OR billing_interval IN ('monthly', 'yearly')),
  ADD COLUMN IF NOT EXISTS current_period_start  timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end    timestamptz;
