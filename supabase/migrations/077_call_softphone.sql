-- ============================================================
-- 077_call_softphone.sql — WhatsApp Calling Layer B (answer + place)
--
-- Migration 050 built Layer A: enable calling on the number, log the
-- webhook's connect/terminate events, show a call chip in the thread.
-- It could not ANSWER a call, because answering means completing a
-- WebRTC handshake, and there was nowhere to put the two halves of it.
--
-- The handshake, end to end:
--   inbound   customer's SDP offer arrives on the webhook's `calls[]`
--             event → stored here as `sdp_offer` → pushed to the agent's
--             browser over Realtime → the browser answers → the answer
--             goes to Meta as action=accept.
--   outbound  the browser makes the offer first → sent to Meta as
--             action=connect → Meta's answer arrives on the webhook →
--             stored as `sdp_answer` → Realtime carries it back to the
--             browser, which sets it as the remote description.
--
-- Why columns rather than reading `raw`: `raw` is overwritten wholesale
-- on every upsert and its shape is Meta's, not ours. The SDP is load
-- bearing — the call does not connect without it — so it gets a column
-- whose meaning cannot drift out from under the client.
--
-- `answered_by` records WHICH agent took the call. Nullable: an inbound
-- call that nobody picked up has no answerer, and Layer A rows predate
-- the concept entirely.
--
-- `status` deliberately stays free TEXT (see migration 050) — Layer B
-- adds 'connecting' and 'in_progress' to the values in circulation, and
-- a CHECK here would have to be widened every time Meta names a new
-- terminate reason.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- The customer's WebRTC offer (inbound calls).
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS sdp_offer TEXT;

-- Meta's WebRTC answer (outbound calls we placed).
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS sdp_answer TEXT;

-- The agent who accepted or placed it.
ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS answered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================
-- Realtime delivery
-- ============================================================
-- The softphone lives in the browser, so the ringing event has to reach
-- it without a poll. call_logs is already SELECT-able by any account
-- member (migration 050) and Realtime respects that policy, so adding
-- the table to the publication exposes nothing new — it only lets
-- members hear about rows they could already read.
--
-- Guarded: adding a table already in the publication raises 42710.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE call_logs;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;  -- publication absent (self-hosted)
END $$;

-- Realtime sends only the primary key in the OLD record unless the
-- table replicates in full; the softphone diffs status transitions
-- (ringing → in_progress → completed), so it needs whole rows.
ALTER TABLE call_logs REPLICA IDENTITY FULL;
