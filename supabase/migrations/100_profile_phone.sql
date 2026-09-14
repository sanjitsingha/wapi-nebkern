-- ============================================================
-- 100_profile_phone
--
-- Make a phone number a required part of registration.
--
-- Until now nothing collected one. The password signup form asked for
-- name, email and password; /welcome (Google signups) asked for name,
-- an optional organization and a referral source. There was no column
-- to put a number in.
--
-- WHY NOT `NOT NULL`
--
-- Every profile that exists today has no number, so a NOT NULL column
-- could not be added. The existing /welcome gate does the enforcing
-- instead:
--
--   profiles.profile_completed_at IS NULL  ->  middleware sends the user
--   to /welcome, and POST /api/account/complete-profile — the only way
--   out — now refuses to stamp it without a valid phone.
--
-- So this migration:
--   1. adds profiles.phone, E.164 with the leading '+', CHECKed;
--   2. teaches handle_new_user to take `phone` and `organization_name`
--      from a password signup's metadata, and to stamp the profile
--      complete ONLY when a valid phone arrived — a signup that skipped
--      the field (a stale tab, a direct API call) lands on /welcome;
--   3. un-stamps every existing profile without a phone, which routes
--      each of those users through /welcome once, on their next request.
--
-- Step 3 needs no separate app_metadata backfill: clearing
-- profile_completed_at fires profiles_app_metadata_sync (079), which
-- writes profile_complete=false into auth.users for the middleware.
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- Same shape the app normalises to (src/lib/auth/signup-phone.ts).
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_phone_e164;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_phone_e164
  CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$');

COMMENT ON COLUMN profiles.phone IS
  'Contact phone given at registration, E.164 with leading +. Required to clear /welcome (migration 100).';

-- Replaces the 073 body. Same account + profile + trial bootstrap.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_org_name TEXT;
  v_phone TEXT;
  v_account_id UUID;
  v_provider TEXT;
  v_completed_at TIMESTAMPTZ;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_org_name  := LEFT(btrim(COALESCE(NEW.raw_user_meta_data->>'organization_name', '')), 120);
  v_phone     := btrim(COALESCE(NEW.raw_user_meta_data->>'phone', ''));
  v_provider  := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

  -- Anything not already canonical is dropped rather than guessed at.
  -- The form normalises before it sends, so a malformed value here came
  -- from something that bypassed the form, and /welcome will ask again.
  IF v_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
    v_phone := NULL;
  END IF;

  -- Only a password signup that brought a valid phone skips /welcome.
  -- OAuth signups never carry one, so they still go through it.
  v_completed_at := CASE
    WHEN v_provider = 'email' AND v_phone IS NOT NULL THEN NOW()
    ELSE NULL
  END;

  INSERT INTO public.accounts (
    name, owner_user_id,
    plan, subscription_status, trial_started_at, trial_ends_at
  )
  VALUES (
    COALESCE(NULLIF(v_org_name, ''), NULLIF(v_full_name, ''), NEW.email, 'My account'),
    NEW.id,
    'trial', 'trialing', NOW(), NOW() + INTERVAL '14 days'
  )
  RETURNING id INTO v_account_id;

  INSERT INTO public.profiles (
    user_id, full_name, email, phone, account_id, account_role, profile_completed_at
  )
  VALUES (
    NEW.id, v_full_name, NEW.email, v_phone, v_account_id, 'owner', v_completed_at
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account\profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Ask everyone without a number, once. The app_metadata sync trigger
-- carries this to the middleware on the same statement.
UPDATE profiles
   SET profile_completed_at = NULL
 WHERE phone IS NULL
   AND profile_completed_at IS NOT NULL;
