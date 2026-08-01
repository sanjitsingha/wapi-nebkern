-- ============================================================
-- 073_signup_identity_and_profile.sql — "one email, one account"
--
-- Three pieces, all serving the signup flow:
--
--   1. profiles.profile_completed_at — gates the post-Google
--      "tell us about yourself" step (/welcome). A password signup
--      already types its full name into the form, so it is stamped
--      complete on arrival; an OAuth signup lands NULL and gets
--      routed through /welcome by src/middleware.ts.
--
--   2. profiles.referral_source — the "how did you hear about us"
--      answer collected on that step. Free text rather than an enum
--      so marketing can reword the option list without a migration
--      (the canonical list lives in src/lib/auth/referral-sources.ts).
--
--   3. public.auth_email_status(text) — a service-role-only lookup
--      answering "is this email taken, and by which provider?".
--
-- Why (3) exists: GoTrue deliberately refuses to tell the browser
-- whether an email is registered (enumeration protection). signUp()
-- on an existing address returns a *decoy* user with an empty
-- identities array and no error, so the naive form shows "check your
-- email" for an account that was never created and the user waits for
-- a mail that never comes. Worse for the Google case — someone who
-- signed up with Google and then tries email+password gets that same
-- silent no-op instead of "your account uses Google".
--
-- So the app asks the database directly, through a SECURITY DEFINER
-- function that is executable ONLY by service_role and returns the
-- bare minimum (a boolean + provider names, never a user id or hash).
-- The anon key cannot reach it; the one caller is the server route
-- /api/auth/check-email, which throttles per IP.
--
-- Grandfathering mirrors 070: profile_completed_at is added WITH a
-- DEFAULT of now() so every existing profile is stamped in one shot,
-- then the default is dropped so new rows follow the trigger's logic.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS is a no-op on re-run (existing
-- profile_completed_at values are never re-stamped), DROP DEFAULT on a
-- defaultless column is harmless, and the function is CREATE OR
-- REPLACE. The trigger from 051 is left bound — the signature of
-- handle_new_user() is unchanged, so replacing the body is enough.
-- ============================================================

-- ---- (1) profile columns -----------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_source TEXT;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE profiles
  ALTER COLUMN profile_completed_at DROP DEFAULT;

COMMENT ON COLUMN profiles.profile_completed_at IS
  'NULL until the user finishes /welcome. Only OAuth signups start NULL; password signups collect the same details on the signup form.';
COMMENT ON COLUMN profiles.referral_source IS
  'Free-text "how did you hear about us" key; option list in src/lib/auth/referral-sources.ts.';

-- ---- (2) signup trigger: stamp completion for password signups ----
-- Replaces the 051 body. Same account+profile+trial bootstrap, now
-- also deciding whether the new profile needs the /welcome step.
--
-- auth.users.raw_app_meta_data->>'provider' is set by GoTrue at insert
-- time: 'email' for a password signup, the provider name ('google',
-- ...) for OAuth. Anything unrecognised is treated as OAuth — the
-- worst case is one extra confirmation screen, versus silently losing
-- the details we meant to collect.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_account_id UUID;
  v_provider TEXT;
  v_completed_at TIMESTAMPTZ;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_provider  := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  v_completed_at := CASE WHEN v_provider = 'email' THEN NOW() ELSE NULL END;

  INSERT INTO public.accounts (
    name, owner_user_id,
    plan, subscription_status, trial_started_at, trial_ends_at
  )
  VALUES (
    COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'), NEW.id,
    'trial', 'trialing', NOW(), NOW() + INTERVAL '14 days'
  )
  RETURNING id INTO v_account_id;

  INSERT INTO public.profiles (
    user_id, full_name, email, account_id, account_role, profile_completed_at
  )
  VALUES (
    NEW.id, v_full_name, NEW.email, v_account_id, 'owner', v_completed_at
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account\profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- ---- (3) email availability lookup -------------------------
-- Returns one row, always:
--   user_exists = false, providers = {}          -> address is free
--   user_exists = true,  providers = {google}    -> Google-only account
--   user_exists = true,  providers = {email,...} -> has a password
--
-- Matching is case-insensitive and trims surrounding whitespace, so
-- " Foo@Example.com " resolves the same row GoTrue would.
CREATE OR REPLACE FUNCTION public.auth_email_status(p_email TEXT)
RETURNS TABLE (user_exists BOOLEAN, providers TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT u.id INTO v_user_id
    FROM auth.users u
   WHERE lower(u.email) = lower(btrim(p_email))
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, ARRAY[]::TEXT[];
    RETURN;
  END IF;

  -- auth.identities is the live source: it also covers a password
  -- account that later linked Google (or vice versa), which a column
  -- snapshotted at signup would miss.
  RETURN QUERY
  SELECT true, COALESCE(array_agg(DISTINCT i.provider), ARRAY[]::TEXT[])
    FROM auth.identities i
   WHERE i.user_id = v_user_id;
END;
$$;

ALTER FUNCTION public.auth_email_status(TEXT) OWNER TO postgres;

-- Service role only. Revoking from PUBLIC also covers anon/authenticated,
-- but they are named explicitly so a future GRANT to either is a visible
-- decision rather than an accident — handing the anon key a bulk email
-- oracle is exactly what this function must not become.
REVOKE ALL ON FUNCTION public.auth_email_status(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_email_status(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.auth_email_status(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.auth_email_status(TEXT) TO service_role;
