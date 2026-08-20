-- ============================================================
-- 086 — account deletion with a 30-day recovery window
--
-- Deleting an account is not immediate. Confirming it starts a grace
-- period: the account is locked out at once, and only after the window
-- expires is anything actually removed. Two reasons for the delay —
-- a regretted or mistaken deletion is recoverable, and a compromised
-- session cannot destroy a business's history in one click.
--
-- Three states, read off `accounts`:
--
--   deletion_requested_at IS NULL      -> live account, normal access
--   deletion_requested_at IS NOT NULL  -> locked; recoverable until
--     and now() < deletion_purge_at       deletion_purge_at
--   now() >= deletion_purge_at         -> due for purge; the accounts
--                                         cron removes it for real
--
-- The lock is enforced in three places, deliberately: middleware (page
-- navigation), requireRole/getCurrentAccount (every API route), and the
-- recovery routes themselves. A single choke point would be one bug
-- away from letting a deleted account back in.
-- ============================================================

-- ---- 1. The deletion window on accounts -----------------------
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_purge_at     TIMESTAMPTZ,
  -- Who pressed the button. Kept for the audit trail and so the
  -- confirmation email can say who did it, which is how an owner finds
  -- out about a deletion they did not perform.
  ADD COLUMN IF NOT EXISTS deletion_requested_by UUID
    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

COMMENT ON COLUMN accounts.deletion_requested_at IS
  'When the owner confirmed deletion. NULL means the account is live.';
COMMENT ON COLUMN accounts.deletion_purge_at IS
  'When the row becomes eligible for real deletion. Recovery is possible until this passes.';

-- Both timestamps move together or not at all. A requested deletion
-- with no purge date would be a permanent lockout that no cron ever
-- collects; a purge date with no request would be a live account with
-- a countdown attached to it.
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_deletion_window_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_deletion_window_check
  CHECK (
    (deletion_requested_at IS NULL AND deletion_purge_at IS NULL)
    OR (deletion_requested_at IS NOT NULL AND deletion_purge_at IS NOT NULL)
  );

-- The purge sweep's only query: due rows, oldest first. Partial, because
-- the overwhelming majority of accounts are live and should not be in
-- this index at all.
CREATE INDEX IF NOT EXISTS idx_accounts_pending_purge
  ON accounts(deletion_purge_at)
  WHERE deletion_requested_at IS NOT NULL;

-- ---- 2. Recovery tokens ---------------------------------------
-- A single-use token emailed to the address on file. Possession of the
-- inbox is the verification: it is the same proof used to reset a
-- password, and it is the one thing an attacker who merely knows the
-- account's email address does not have.
CREATE TABLE IF NOT EXISTS account_recovery_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- The address the link was sent to, captured at request time so a
  -- later change to the profile cannot retarget an outstanding token.
  email TEXT NOT NULL,
  -- SHA-256 of the token, never the token itself. A leaked database
  -- backup must not hand over working recovery links, exactly as with
  -- password hashes.
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  requested_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_recovery_tokens_account
  ON account_recovery_tokens(account_id);

-- Service-role only. RLS is on with no policies at all, which denies
-- every anon and authenticated request: nobody is signed in to a
-- deleted account by definition, so the recovery routes run with the
-- service key and there is no legitimate client-side read.
ALTER TABLE account_recovery_tokens ENABLE ROW LEVEL SECURITY;

-- ---- 3. Carry the lock into app_metadata ----------------------
-- Extends 079. The middleware already reads app_metadata on every
-- protected navigation, so the lock costs nothing extra there — and
-- getUser() reads the live auth row rather than the JWT's copy, so a
-- recovery lets someone back in on the very next request instead of
-- after a token refresh.
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
  a_pending_del  BOOLEAN;
BEGIN
  SELECT
    p.account_id,
    p.account_role::TEXT,
    a.name,
    p.profile_completed_at IS NOT NULL,
    a.onboarded_at IS NOT NULL,
    a.deletion_requested_at IS NOT NULL
  INTO p_account_id, p_account_role, a_name, p_complete, a_onboarded, a_pending_del
  FROM profiles p
  JOIN accounts a ON a.id = p.account_id
  WHERE p.user_id = target_user_id;

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
             'onboarded',        a_onboarded,
             'pending_deletion', a_pending_del
           )
  WHERE id = target_user_id;
END;
$$;

ALTER FUNCTION sync_user_app_metadata(UUID) OWNER TO postgres;

-- Fan the lock out to every member the moment it is set or cleared.
CREATE OR REPLACE FUNCTION accounts_sync_app_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.onboarded_at IS DISTINCT FROM OLD.onboarded_at
     OR NEW.deletion_requested_at IS DISTINCT FROM OLD.deletion_requested_at THEN
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
  AFTER UPDATE OF name, onboarded_at, deletion_requested_at ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION accounts_sync_app_metadata();

-- ---- 4. Backfill the new key ----------------------------------
-- Existing sessions carry app_metadata without `pending_deletion`.
-- The app treats a missing key as "not deleted", but stamping it now
-- keeps the fast path whole rather than relying on that fallback.
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
  RAISE NOTICE '086: synced app_metadata for % user(s)', n;
END $$;
