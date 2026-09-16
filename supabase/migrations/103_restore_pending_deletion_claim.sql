-- ============================================================
-- 103 — put the deletion lock back into app_metadata
--
-- WHY THIS EXISTS
--
-- Migration 086 gave the account-deletion feature its lock: scheduling a
-- deletion stamps `accounts.deletion_requested_at`, a trigger fans a
-- `pending_deletion` claim out to every member's
-- auth.users.raw_app_meta_data, and both the middleware and
-- getCurrentAccount's fast path read that claim to shut the account.
--
-- Migration 087 then rewrote the same three objects to add the
-- subscription fields, and in doing so dropped every deletion-aware
-- part of them:
--
--   * sync_user_app_metadata stopped writing `pending_deletion`, so the
--     claim kept whatever value 086's backfill left — `false`.
--   * accounts_sync_app_metadata stopped testing deletion_requested_at.
--   * the trigger's AFTER UPDATE OF list stopped naming that column, so
--     stamping a deletion no longer fired the sync at all.
--
-- The result, measured on production today: an account with
-- deletion_requested_at set, its owner's claim still reading
-- "pending_deletion": "false", and that owner able to sign in, reload
-- and keep using the account the UI had told them was closed. The lock
-- had been silently absent since 087. The 30-day purge, once scheduled,
-- would have erased an account its owner was still working in.
--
-- This restores all three objects: 087's fields, plus 086's key and its
-- trigger condition. The final backfill re-derives the claim for every
-- user, which is what closes accounts already inside a window.
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
    a.deletion_requested_at IS NOT NULL
  INTO
    p_account_id, p_account_role, a_name, p_complete, a_onboarded,
    a_plan, a_sub_status, a_trial_ends, a_pending_del
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
             'pending_deletion',    a_pending_del
           )
  WHERE id = target_user_id;
END;
$$;

ALTER FUNCTION sync_user_app_metadata(UUID) OWNER TO postgres;

-- ---- 2. Re-sync on a deletion being scheduled or undone -----
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
     OR NEW.deletion_requested_at IS DISTINCT FROM OLD.deletion_requested_at THEN
    PERFORM sync_user_app_metadata(p.user_id)
    FROM profiles p
    WHERE p.account_id = NEW.id AND p.user_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION accounts_sync_app_metadata() OWNER TO postgres;

-- AFTER UPDATE OF only fires for the columns it names, so
-- deletion_requested_at has to be listed here as well as tested above.
DROP TRIGGER IF EXISTS accounts_app_metadata_sync ON accounts;
CREATE TRIGGER accounts_app_metadata_sync
  AFTER UPDATE OF name, onboarded_at, plan, subscription_status,
                  trial_ends_at, deletion_requested_at ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION accounts_sync_app_metadata();

-- ---- 3. Backfill every claim --------------------------------
-- Rewrites `pending_deletion` from the column for every member, which
-- both corrects the stale `false` left by 087 and locks out any account
-- already inside its deletion window.
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
  RAISE NOTICE '103: re-synced app_metadata for % user(s)', n;
END $$;
