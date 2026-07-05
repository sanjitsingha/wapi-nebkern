-- ============================================================
-- 035_conversation_assigned_flow.sql — assign a conversation to a bot
--
-- The inbox "Assign" dropdown can now hand a conversation to a Flow
-- (bot) instead of a human agent. This records which flow is driving
-- the conversation so the UI can show the bot's name as the assignee.
--
--   - assigned_flow_id → the flow currently handling this conversation
--     (NULL when a human agent owns it, or nobody does)
--
-- ON DELETE SET NULL: deleting a flow simply un-assigns any
-- conversations it was driving rather than cascading them away.
--
-- The actual bot behavior is driven by flow_runs (the engine advances
-- the per-contact run on each inbound message); this column is the
-- conversation-level pointer the inbox reads for its label.
--
-- Account members (agent+) can set it through the existing
-- conversations_update RLS policy (migration 017) — no new policy.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS assigned_flow_id UUID
    REFERENCES flows(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS conversations_assigned_flow_idx
  ON conversations(assigned_flow_id)
  WHERE assigned_flow_id IS NOT NULL;
