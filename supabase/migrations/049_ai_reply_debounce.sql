-- ============================================================
-- 049_ai_reply_debounce.sql — burst-coalescing for AI auto-reply
--
-- Problem: a customer who fires several quick messages ("Hi" / "Hey" /
-- "How are you") gets one bot reply PER message, because each inbound
-- spawns its own reply-engine invocation and they don't coordinate.
-- Comparing "which message is newest" doesn't fix it — insertion
-- latency lets multiple invocations anchor on the SAME latest message
-- and all reply together, and WhatsApp timestamps are second-grained
-- so ties are common.
--
-- Fix: a monotonic per-conversation sequence + deadline. Every eligible
-- inbound BUMPS the sequence (superseding any earlier waiting
-- invocation) and pushes the deadline to now()+delay. Each invocation
-- then waits and CLAIMS: the claim only succeeds for the holder of the
-- current (highest) sequence once the deadline has elapsed. Because the
-- sequence is a real counter, exactly one invocation per burst can ever
-- win — no ties, no dependence on message ordering.
--
--   - `conversations.ai_debounce_seq`      — monotonic bump counter.
--   - `conversations.ai_debounce_deadline` — when the quiet period ends;
--     NULL once claimed (so a claim can't fire twice).
--
-- Runs under the service-role client from the reply engine (no
-- auth.uid()), so no extra RLS is needed — same as claim_ai_reply_slot.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_debounce_seq bigint NOT NULL DEFAULT 0;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_debounce_deadline timestamptz;

-- Bump: called once per eligible inbound message. Increments the
-- sequence (so any earlier invocation still waiting is now stale) and
-- (re)sets the deadline to now() + p_delay_ms. Returns the new sequence
-- value for the caller to hold and present to claim_ai_reply_debounce.
CREATE OR REPLACE FUNCTION public.bump_ai_reply_debounce(
  p_conversation_id uuid,
  p_delay_ms integer
)
RETURNS bigint AS $$
  UPDATE conversations
  SET ai_debounce_seq = ai_debounce_seq + 1,
      ai_debounce_deadline = now() + make_interval(secs => p_delay_ms / 1000.0)
  WHERE id = p_conversation_id
  RETURNING ai_debounce_seq;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Claim: called after the caller has waited out the quiet period.
-- Succeeds (returns true, and clears the deadline so no one else can
-- also win) only when the caller still holds the latest sequence AND
-- the deadline has actually elapsed — i.e. no newer message bumped past
-- it. Atomic single UPDATE, so at most one caller per burst wins.
CREATE OR REPLACE FUNCTION public.claim_ai_reply_debounce(
  p_conversation_id uuid,
  p_seq bigint
)
RETURNS boolean AS $$
  WITH claimed AS (
    UPDATE conversations
    SET ai_debounce_deadline = NULL
    WHERE id = p_conversation_id
      AND ai_debounce_seq = p_seq
      AND ai_debounce_deadline IS NOT NULL
      AND ai_debounce_deadline <= now()
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM claimed);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Read the current sequence — lets a waiting invocation notice it's
-- been superseded and stand down early instead of sleeping out the
-- whole window. Correctness rests on the atomic claim above; this is
-- only an optimization, so a plain read is fine.
CREATE OR REPLACE FUNCTION public.current_ai_reply_debounce_seq(
  p_conversation_id uuid
)
RETURNS bigint AS $$
  SELECT ai_debounce_seq FROM conversations WHERE id = p_conversation_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Same lockdown rationale as claim_ai_reply_slot (039): SECURITY DEFINER
-- functions default to PUBLIC/anon and bypass RLS, so restrict EXECUTE
-- to the service-role client the reply engine runs under.
REVOKE ALL ON FUNCTION public.bump_ai_reply_debounce(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_ai_reply_debounce(uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.claim_ai_reply_debounce(uuid, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_ai_reply_debounce(uuid, bigint) TO service_role;

REVOKE ALL ON FUNCTION public.current_ai_reply_debounce_seq(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_ai_reply_debounce_seq(uuid) TO service_role;
