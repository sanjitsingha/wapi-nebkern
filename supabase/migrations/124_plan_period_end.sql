-- ============================================================
-- 124 — Paid plans end when their period does; only Instant can
-- change a plan.
--
-- WHY THIS EXISTS
--
-- A plan bought through Razorpay, redeemed with an activation code or
-- assigned in the admin panel sets subscription_status = 'active' and a
-- current_period_end. Nothing ever read that end date. The app only
-- expired trials, and the middleware's paywall works from a copy of the
-- plan in each user's app_metadata that had no period end in it at all.
-- A plan given on 3 Aug with its period ending 3 Sep was still live on
-- 22 Oct.
--
-- The app now folds the period end in on read, the same way it does
-- trial_ends_at (src/lib/billing/subscription.ts). This migration:
--
--   1. carries current_period_end into app_metadata, so the paywall sees
--      it without a query. sync_user_app_metadata keeps every key from
--      103 and adds this one;
--   2. re-syncs when a period changes (a renewal, an extension);
--   3. stops a workspace's own users rewriting their plan. accounts_update
--      lets a workspace admin update the account row, and that included
--      the plan, its status and its dates: one direct API call could
--      turn on any plan, for any length of time, for free. The same went
--      for owner_user_id (an admin making themselves owner) and the
--      deletion columns (undoing a scheduled deletion). These now change
--      only through the server (service role) or the SECURITY DEFINER
--      functions built for them: activation codes, ownership transfer.
-- ============================================================

-- ---- 1. The one writer, carrying every claim ----------------
-- Any future edit to this function MUST keep all of the keys below.
-- Two migrations have now added fields by rewriting it wholesale; a
-- third that forgets one silently disables whichever gate reads it.
CREATE OR REPLACE FUNCTION sync_user_app_metadata(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_account_id   UUID;
  p_account_role TEXT;
  a_name         TEXT;
  p_complete     BOOLEAN;
  a_onboarded    BOOLEAN;
  a_plan         TEXT;
  a_sub_status   TEXT;
  a_trial_ends   TIMESTAMPTZ;
  a_period_end   TIMESTAMPTZ;
  a_pending_del  BOOLEAN;
BEGIN
  SELECT
    p.account_id,
    p.account_role::TEXT,
    a.name,
    p.profile_completed_at IS NOT NULL,
    a.onboarded_at IS NOT NULL,
    a.plan,
    a.subscription_status::TEXT,
    a.trial_ends_at,
    a.current_period_end,
    a.deletion_requested_at IS NOT NULL
  INTO
    p_account_id, p_account_role, a_name, p_complete, a_onboarded,
    a_plan, a_sub_status, a_trial_ends, a_period_end, a_pending_del
  FROM profiles p
  JOIN accounts a ON a.id = p.account_id
  WHERE p.user_id = target_user_id;

  -- No profile yet (mid-signup). Leave metadata alone; the app's
  -- fallback query handles this window, and the trigger fires again
  -- when the row lands.
  IF p_account_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data =
        COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object(
             'account_id',          p_account_id,
             'account_role',        p_account_role,
             'account_name',        a_name,
             'profile_complete',    p_complete,
             'onboarded',           a_onboarded,
             'plan',                a_plan,
             'subscription_status', a_sub_status,
             'trial_ends_at',       a_trial_ends,
             'current_period_end',  a_period_end,
             'pending_deletion',    a_pending_del
           )
  WHERE id = target_user_id;
END;
$$;

ALTER FUNCTION sync_user_app_metadata(UUID) OWNER TO postgres;

-- ---- 2. Re-sync when any of those account fields change -----
CREATE OR REPLACE FUNCTION accounts_sync_app_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.onboarded_at IS DISTINCT FROM OLD.onboarded_at
     OR NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
     OR NEW.current_period_end IS DISTINCT FROM OLD.current_period_end
     OR NEW.deletion_requested_at IS DISTINCT FROM OLD.deletion_requested_at THEN
    PERFORM sync_user_app_metadata(p.user_id)
    FROM profiles p
    WHERE p.account_id = NEW.id AND p.user_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION accounts_sync_app_metadata() OWNER TO postgres;

-- AFTER UPDATE OF only fires for the columns it names, so each one has
-- to be listed here as well as tested above.
DROP TRIGGER IF EXISTS accounts_app_metadata_sync ON accounts;
CREATE TRIGGER accounts_app_metadata_sync
  AFTER UPDATE OF name, onboarded_at, plan, subscription_status,
                  trial_ends_at, current_period_end, deletion_requested_at
  ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION accounts_sync_app_metadata();

-- ---- 3. Plan, ownership and deletion are Instant's to change -
-- current_user is the caller's role for a direct API request
-- ('authenticated'), and the function's owner inside a SECURITY DEFINER
-- function — which is how redeem_activation_code and
-- transfer_account_ownership still get through. The server's service
-- role is never blocked. Anything else a member may edit (the name, the
-- currency) is untouched.
CREATE OR REPLACE FUNCTION accounts_protect_server_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND (
       NEW.plan                  IS DISTINCT FROM OLD.plan
    OR NEW.subscription_status   IS DISTINCT FROM OLD.subscription_status
    OR NEW.trial_started_at      IS DISTINCT FROM OLD.trial_started_at
    OR NEW.trial_ends_at         IS DISTINCT FROM OLD.trial_ends_at
    OR NEW.onboarded_at          IS DISTINCT FROM OLD.onboarded_at
    OR NEW.billing_plan_key      IS DISTINCT FROM OLD.billing_plan_key
    OR NEW.billing_amount        IS DISTINCT FROM OLD.billing_amount
    OR NEW.billing_currency      IS DISTINCT FROM OLD.billing_currency
    OR NEW.billing_interval      IS DISTINCT FROM OLD.billing_interval
    OR NEW.current_period_start  IS DISTINCT FROM OLD.current_period_start
    OR NEW.current_period_end    IS DISTINCT FROM OLD.current_period_end
    OR NEW.owner_user_id         IS DISTINCT FROM OLD.owner_user_id
    OR NEW.deletion_requested_at IS DISTINCT FROM OLD.deletion_requested_at
    OR NEW.deletion_purge_at     IS DISTINCT FROM OLD.deletion_purge_at
    OR NEW.deletion_requested_by IS DISTINCT FROM OLD.deletion_requested_by
    OR NEW.deletion_reason       IS DISTINCT FROM OLD.deletion_reason
  ) THEN
    RAISE EXCEPTION 'Plan, ownership and deletion can only be changed by Instant.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounts_protect_server_columns ON accounts;
CREATE TRIGGER accounts_protect_server_columns
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION accounts_protect_server_columns();

-- ---- 4. Backfill the new claim for everyone ------------------
DO $$
DECLARE
  r RECORD;
  n BIGINT := 0;
BEGIN
  FOR r IN
    SELECT p.user_id
    FROM profiles p
    JOIN accounts a ON a.id = p.account_id
    WHERE p.user_id IS NOT NULL
  LOOP
    PERFORM sync_user_app_metadata(r.user_id);
    n := n + 1;
  END LOOP;
  RAISE NOTICE '124: re-synced app_metadata for % user(s)', n;
END $$;
