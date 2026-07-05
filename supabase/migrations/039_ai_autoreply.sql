-- ============================================================
-- 039_ai_autoreply.sql — inbound AI auto-reply bot
--
-- The AI config (038) already carries `auto_reply_enabled` and
-- `auto_reply_max_per_conversation`. This migration adds the two
-- per-conversation columns the bot needs to stay bounded, plus an
-- atomic slot-claim function so concurrent inbound messages can never
-- overshoot the per-conversation cap.
--
--   - `conversations.ai_autoreply_disabled` — set true when the model
--     signals a human handoff, or when someone turns the bot off for
--     that one thread. Sticky: once handed off it stays off until
--     explicitly re-enabled.
--   - `conversations.ai_reply_count` — running count of bot auto-replies
--     in the thread, checked against `auto_reply_max_per_conversation`.
--
-- The bot runs under the service-role client from the webhook (no
-- auth.uid()), so these need no extra RLS.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_autoreply_disabled boolean NOT NULL DEFAULT false;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_reply_count integer NOT NULL DEFAULT 0;

-- ============================================================
-- Atomic auto-reply slot claim.
--
-- The bot claims a reply slot through this function rather than a
-- read-then-write from the app: two inbound messages on one
-- conversation can be processed concurrently, and a client-side
-- "read count, check < cap, then increment" would let both pass the
-- check and overshoot the per-conversation cap. Here the cap check and
-- the `+ 1` happen in a single UPDATE, so exactly `max_replies` slots
-- can ever be claimed. Returns true when a slot was claimed (the caller
-- may send), false when the cap is already reached (skip).
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_ai_reply_slot(
  conversation_id uuid,
  max_replies integer
)
RETURNS boolean AS $$
  WITH claimed AS (
    UPDATE conversations
    SET ai_reply_count = ai_reply_count + 1
    WHERE id = conversation_id
      AND ai_reply_count < max_replies
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM claimed);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Lock down EXECUTE. This is SECURITY DEFINER and would otherwise
-- default to PUBLIC (the anon role) — which, since it bypasses RLS and
-- mutates a counter by conversation id, would let an unauthenticated
-- caller who guessed a conversation UUID inflate ai_reply_count and
-- permanently silence the bot on that thread. Only the auto-reply bot
-- (service-role client) ever claims a slot.
REVOKE ALL ON FUNCTION public.claim_ai_reply_slot(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_ai_reply_slot(uuid, integer) TO service_role;
