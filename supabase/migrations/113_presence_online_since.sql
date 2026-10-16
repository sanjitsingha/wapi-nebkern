-- ============================================================
-- Presence: when a member came online.
--
-- member_presence only knew the last heartbeat, which answers "last
-- seen" for someone offline but not "online since" for someone who is
-- on — the dashboard's Team panel shows both.
--
-- online_since is stamped by touch_presence, the only writer, when a
-- session STARTS: the first row, a row that was stored 'offline' (the
-- Unavailable toggle), or one whose last heartbeat is older than the
-- client's offline threshold (150 s — lib/presence.ts OFFLINE_AFTER_MS)
-- because the tab was closed. Online <-> away is the same session and
-- keeps its stamp. Going 'offline' clears it; last_seen_at then says
-- when they left.
-- ============================================================

ALTER TABLE member_presence
  ADD COLUMN IF NOT EXISTS online_since timestamptz;

-- Rows already online when this runs: their current session started no
-- later than the last heartbeat, so that is the honest lower bound.
UPDATE member_presence
SET online_since = last_seen_at
WHERE online_since IS NULL
  AND status <> 'offline';

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

  INSERT INTO member_presence (user_id, account_id, status, last_seen_at, online_since)
  VALUES (
    auth.uid(),
    v_account_id,
    p_status,
    now(),
    CASE WHEN p_status = 'offline' THEN NULL ELSE now() END
  )
  ON CONFLICT (user_id) DO UPDATE
    SET online_since = CASE
          WHEN excluded.status = 'offline' THEN NULL
          WHEN member_presence.status = 'offline'
            OR member_presence.online_since IS NULL
            OR member_presence.last_seen_at < now() - interval '150 seconds'
            THEN now()
          ELSE member_presence.online_since
        END,
        status       = excluded.status,
        last_seen_at = now(),
        account_id   = excluded.account_id;
END;
$$;
