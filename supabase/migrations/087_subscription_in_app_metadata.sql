-- ============================================================
-- 087 — mirror subscription state into auth.users.app_metadata
--
-- WHY THIS EXISTS
--
-- Migration 079 mirrored the near-static onboarding facts (profile_complete,
-- onboarded) into app_metadata so the middleware gate could read them from
-- the getUser() call it already makes, with no extra query.
--
-- The middleware now enforces a second gate: an account whose plan has
-- LAPSED (trial expired, or a paid plan gone canceled/past_due/expired) is
-- hard-redirected to the paywall (/onboarding) and kept out of the app.
-- Deciding that per navigation needs the same three fields computeSubscription
-- reads — plan, subscription_status, trial_ends_at — so we mirror them here
-- too and keep the gate query-free.
--
-- FRESHNESS
--
-- trial_ends_at is a FIXED timestamp: once mirrored, the middleware compares
-- it to `now` on every request, so trial expiry needs no re-sync and no cron
-- to stay correct. subscription_status / plan change only on a real event
-- (paying, cancellation, starting the trial) — the trigger below re-syncs on
-- exactly those, and getUser() reads the live auth row, so a payment opens
-- the gate on the very next request.
-- ============================================================

-- ---- 1. Extend the single recompute function -----------------
-- Same one writer as 079, now carrying the three subscription fields as
-- well. subscription_status is an enum -> cast to text so jsonb_build_object
-- stores a plain string; trial_ends_at serialises to an ISO string (or null
-- for a paid account that never trialed), which computeSubscription's
-- parseTime handles.
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
BEGIN
  SELECT
    p.account_id,
    p.account_role::TEXT,
    a.name,
    p.profile_completed_at IS NOT NULL,
    a.onboarded_at IS NOT NULL,
    a.plan,
    a.subscription_status::TEXT,
    a.trial_ends_at
  INTO
    p_account_id, p_account_role, a_name, p_complete, a_onboarded,
    a_plan, a_sub_status, a_trial_ends
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
             'trial_ends_at',       a_trial_ends
           )
  WHERE id = target_user_id;
END;
$$;

ALTER FUNCTION sync_user_app_metadata(UUID) OWNER TO postgres;

-- ---- 2. Widen the accounts trigger ---------------------------
-- 079's version fired only on name / onboarded_at. Add the subscription
-- columns so paying, cancelling, or a trial (re)starting re-syncs every
-- member of the account.
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
     OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
    PERFORM sync_user_app_metadata(p.user_id)
    FROM profiles p
    WHERE p.account_id = NEW.id AND p.user_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION accounts_sync_app_metadata() OWNER TO postgres;

DROP TRIGGER IF EXISTS accounts_app_metadata_sync ON accounts;
CREATE TRIGGER accounts_app_metadata_sync
  AFTER UPDATE OF name, onboarded_at, plan, subscription_status, trial_ends_at
  ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION accounts_sync_app_metadata();

-- ---- 3. Backfill every existing member ------------------------
-- Existing sessions carry 079's five keys but not these three; without a
-- backfill the middleware would take the fallback query for everyone until
-- their next subscription change. Re-running the sync adds the new keys.
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
  RAISE NOTICE '087: re-synced app_metadata for % user(s)', n;
END $$;
