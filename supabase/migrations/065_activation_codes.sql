-- ============================================================
-- 065_activation_codes.sql — prepaid activation codes
--
-- Admin generates codes in the back office; a tenant owner/admin
-- redeems one in the app (Settings → Billing) to activate a plan
-- for a fixed number of days — no payment provider involved.
--
-- What this adds
--   1. activation_codes — the codes themselves. Each is bound to a
--      billing_plans key and a duration in days. `max_uses` lets one
--      code serve several DIFFERENT accounts (a partner/promo code);
--      a single account can never redeem the same code twice.
--   2. activation_code_redemptions — who redeemed what, when.
--   3. redeem_activation_code(p_code) — SECURITY DEFINER RPC that does
--      the whole redemption atomically: validates the code, snapshots
--      the plan price onto the account (mirroring how the admin panel
--      assigns billing, migration 054), flips the subscription to
--      'active', and stamps the current period. Stacking: redeeming
--      onto an unexpired period OF THE SAME PLAN extends it; anything
--      else starts a fresh period from now.
--
-- RLS: both tables are service-role only (no policies) — tenants
-- interact exclusively through the RPC, admins through the
-- service-role client. The RPC checks the caller's role itself.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ---- (1) codes ---------------------------------------------
CREATE TABLE IF NOT EXISTS activation_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,        -- stored uppercase: WAPI-XXXX-XXXX-XXXX
  plan_key      text NOT NULL REFERENCES billing_plans(key) ON UPDATE CASCADE,
  duration_days integer NOT NULL CHECK (duration_days > 0),
  max_uses      integer NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  use_count     integer NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  expires_at    timestamptz,                 -- redemption deadline for the CODE (not the plan period)
  is_active     boolean NOT NULL DEFAULT true,
  note          text,                        -- admin memo ("Diwali promo", "Client X")
  created_by    uuid,                        -- admin auth.uid()
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activation_codes ENABLE ROW LEVEL SECURITY;

-- ---- (2) redemptions ---------------------------------------
CREATE TABLE IF NOT EXISTS activation_code_redemptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id     uuid NOT NULL REFERENCES activation_codes(id) ON DELETE CASCADE,
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  redeemed_by uuid,                          -- tenant auth.uid()
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code_id, account_id)
);

ALTER TABLE activation_code_redemptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS activation_code_redemptions_account_idx
  ON activation_code_redemptions (account_id);

-- ---- (3) redemption RPC ------------------------------------
-- Returns jsonb: { ok: true, plan_key, plan_name, duration_days,
-- period_end } on success, or { ok: false, error: <slug> } where slug ∈
-- invalid_code | code_disabled | code_expired | code_exhausted |
-- already_redeemed | plan_unavailable | no_account | forbidden.
-- Errors are values (not exceptions) so the API route can map them to
-- friendly messages without string-matching Postgres errors.
CREATE OR REPLACE FUNCTION public.redeem_activation_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_account uuid;
  v_role    text;
  v_code    activation_codes%ROWTYPE;
  v_plan    billing_plans%ROWTYPE;
  v_base    timestamptz;
  v_end     timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT account_id, account_role INTO v_account, v_role
    FROM profiles WHERE user_id = v_uid;
  IF v_account IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_account');
  END IF;
  IF v_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- Lock the code row so concurrent redemptions serialize on use_count.
  SELECT * INTO v_code
    FROM activation_codes
   WHERE code = upper(trim(p_code))
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;
  IF NOT v_code.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_disabled');
  END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_expired');
  END IF;
  IF v_code.use_count >= v_code.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_exhausted');
  END IF;
  IF EXISTS (
    SELECT 1 FROM activation_code_redemptions
     WHERE code_id = v_code.id AND account_id = v_account
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
  END IF;

  SELECT * INTO v_plan FROM billing_plans
   WHERE key = v_code.plan_key AND is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'plan_unavailable');
  END IF;

  -- Same plan with time left → stack on top of the current period;
  -- otherwise the new period starts now.
  SELECT CASE
           WHEN a.billing_plan_key = v_code.plan_key
            AND a.current_period_end IS NOT NULL
            AND a.current_period_end > now()
           THEN a.current_period_end
           ELSE now()
         END
    INTO v_base
    FROM accounts a
   WHERE a.id = v_account
   FOR UPDATE;

  v_end := v_base + make_interval(days => v_code.duration_days);

  UPDATE accounts
     SET plan                 = v_code.plan_key,
         subscription_status  = 'active',
         billing_plan_key     = v_code.plan_key,
         billing_amount       = v_plan.amount,
         billing_currency     = v_plan.currency,
         billing_interval     = v_plan.interval,
         current_period_start = CASE WHEN v_base > now() THEN current_period_start ELSE now() END,
         current_period_end   = v_end
   WHERE id = v_account;

  INSERT INTO activation_code_redemptions (code_id, account_id, redeemed_by)
  VALUES (v_code.id, v_account, v_uid);

  UPDATE activation_codes
     SET use_count = use_count + 1
   WHERE id = v_code.id;

  RETURN jsonb_build_object(
    'ok', true,
    'plan_key', v_code.plan_key,
    'plan_name', v_plan.name,
    'duration_days', v_code.duration_days,
    'period_end', v_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_activation_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.redeem_activation_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_activation_code(text) TO service_role;
