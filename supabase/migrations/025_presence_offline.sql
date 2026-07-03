-- ============================================================
-- 025_presence_offline.sql — manual "unavailable" presence
--
-- Adds an explicit 'offline' stored status so a member can mark
-- themselves unavailable from the account menu while their tab is
-- still open. Previously 'offline' was ONLY ever derived from
-- staleness (migration 024); there was no way to appear offline
-- on purpose.
--
-- The heartbeat now reports 'offline' while the member toggles
-- availability off, and viewers render that immediately (no 75s
-- staleness wait). Toggling back on resumes 'online'/'away'.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ---- widen the status CHECK to include 'offline' -----------
ALTER TABLE member_presence
  DROP CONSTRAINT IF EXISTS member_presence_status_check;

ALTER TABLE member_presence
  ADD CONSTRAINT member_presence_status_check
  CHECK (status IN ('online', 'away', 'offline'));

-- ---- heartbeat RPC: accept 'offline' -----------------------
-- Same body as migration 024 with the validation list widened.
CREATE OR REPLACE FUNCTION public.touch_presence(
  p_status TEXT DEFAULT 'online'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('online', 'away', 'offline') THEN
    RAISE EXCEPTION 'Invalid presence status: %', p_status
      USING ERRCODE = '22023';
  END IF;

  SELECT account_id INTO v_account_id
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'No account for caller' USING ERRCODE = '22023';
  END IF;

  INSERT INTO member_presence (user_id, account_id, status, last_seen_at)
  VALUES (auth.uid(), v_account_id, p_status, now())
  ON CONFLICT (user_id) DO UPDATE
    SET status       = excluded.status,
        last_seen_at = now(),
        account_id   = excluded.account_id;
END;
$$;
