-- ============================================================
-- 028_realtime_replica_identity
--
-- Make inbox Realtime reliable under RLS.
--
-- Supabase Realtime evaluates each table's RLS SELECT policy against
-- the changed row before delivering it to a subscribed client. Since
-- 017_account_sharing, those policies reference NON-primary-key columns:
--
--   messages_select      -> messages.conversation_id (joins conversations)
--   conversations policy -> conversations.account_id
--
-- With the default REPLICA IDENTITY (primary key only), UPDATE and
-- DELETE WAL records carry just the PK in their `old` image — so
-- Realtime can't see conversation_id / account_id to authorize the row,
-- and silently DROPS the event for RLS-restricted clients. That's why
-- the inbox was flaky: message INSERTs (full row in WAL) mostly arrived,
-- but the conversation-list "new message" bump (an UPDATE) often didn't.
--
-- REPLICA IDENTITY FULL logs the complete old row in WAL, so the policy
-- can always be evaluated and every event is delivered. Cost is a little
-- extra WAL volume on these tables — negligible at inbox scale.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE messages          REPLICA IDENTITY FULL;
ALTER TABLE conversations     REPLICA IDENTITY FULL;
ALTER TABLE message_reactions REPLICA IDENTITY FULL;
