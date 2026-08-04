-- ============================================================
-- 079 — mirror account context into auth.users.app_metadata
--
-- WHY THIS EXISTS
--
-- Two hot paths re-read the same near-static facts on every request.
--
-- 1. `getCurrentAccount()` (src/lib/auth/account.ts), called by 68 API
--    route files, did:
--       a. supabase.auth.getUser()   — network call to Supabase Auth
--       b. SELECT ... FROM profiles  — to learn account_id + role
--    (b) is pure repetition: a user's account and role change maybe
--    once in the life of the account.
--
-- 2. The onboarding gate in src/middleware.ts ran a
--    profiles + accounts join on EVERY protected page navigation, just
--    to test two nullable timestamps that, once set, never unset.
--
-- Both already call `getUser()`, and `getUser()` returns the user's
-- `app_metadata` straight from the auth schema. Mirroring these values
-- there makes both extra queries disappear into a call we were already
-- making.
--
-- Chosen over a Custom Access Token Hook (needs Supabase console
-- configuration, and only refreshes on token rotation) and over a
-- signed cookie for the gate (forgeable surface in front of a paywall).
--
-- FRESHNESS
--
-- getUser() reads the live auth.users row, not the copy baked into the
-- client's JWT, so a change here takes effect on the very next request
-- — no waiting on a token refresh. That matters for the gate: paying
-- for a plan must let you in immediately.
--
-- The application still falls back to querying when a key is missing,
-- so sessions predating this migration keep working.
-- ============================================================

-- ---- 1. One recompute, one writer -----------------------------
-- Every trigger below funnels through this. Deriving all keys in one
-- place means no trigger can clobber another's work, and there is a
-- single definition of what the metadata means.
--
-- SECURITY DEFINER because the auth schema is not writable by the roles
-- that cause these changes. Merges rather than replaces, so Supabase's
-- own keys (provider, providers, ...) survive untouched.
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
BEGIN
  SELECT
    p.account_id,
    p.account_role::TEXT,
    a.name,
    p.profile_completed_at IS NOT NULL,
    a.onboarded_at IS NOT NULL
  INTO p_account_id, p_account_role, a_name, p_complete, a_onboarded
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
             'account_id',       p_account_id,
             'account_role',     p_account_role,
             'account_name',     a_name,
             'profile_complete', p_complete,
             'onboarded',        a_onboarded
           )
  WHERE id = target_user_id;
END;
$$;

ALTER FUNCTION sync_user_app_metadata(UUID) OWNER TO postgres;

-- ---- 2. Triggers ----------------------------------------------
-- profiles: joining an account, a role change, or clearing the
-- /welcome gate.
CREATE OR REPLACE FUNCTION profiles_sync_app_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    PERFORM sync_user_app_metadata(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION profiles_sync_app_metadata() OWNER TO postgres;

DROP TRIGGER IF EXISTS profiles_app_metadata_sync ON profiles;
CREATE TRIGGER profiles_app_metadata_sync
  AFTER INSERT OR UPDATE OF account_id, account_role, profile_completed_at
  ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION profiles_sync_app_metadata();

-- accounts: a rename, or clearing the /onboarding gate by starting a
-- trial or paying. Fans out to every member of the account.
CREATE OR REPLACE FUNCTION accounts_sync_app_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.onboarded_at IS DISTINCT FROM OLD.onboarded_at THEN
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
  AFTER UPDATE OF name, onboarded_at ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION accounts_sync_app_metadata();

-- ---- 3. Backfill every existing member ------------------------
-- Without this the fast paths never engage for anyone who signed up
-- before today — every request would keep taking the fallback query.
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
  RAISE NOTICE '079: synced app_metadata for % user(s)', n;
END $$;
