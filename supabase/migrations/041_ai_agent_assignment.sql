-- ============================================================
-- 041_ai_agent_assignment.sql — per-conversation AI agent assignment
--
-- Lets the inbox hand a single conversation to the account's AI agent
-- (the BYO-key assistant from 038–040), the same way it hands one to a
-- human agent or a Flow. When set, the auto-reply engine answers every
-- inbound on that thread regardless of the account-wide
-- `auto_reply_enabled` toggle and without the per-conversation cap —
-- the user explicitly chose "the AI owns this chat".
--
--   - Mutually exclusive with `assigned_agent_id` / `assigned_flow_id`
--     (enforced in the assign route, mirroring how agent vs flow is
--     already kept exclusive there).
--   - The master switch (`ai_configs.is_active`) still governs: turning
--     the assistant off silences assigned chats too.
--   - On a handoff signal the engine clears this flag so the chat
--     surfaces as unassigned for a human to pick up.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_agent_assigned boolean NOT NULL DEFAULT false;

-- Partial index: the webhook reads this per-conversation (PK lookup), so
-- no index is strictly needed; this one keeps "which chats does the AI
-- own" dashboard queries cheap without indexing the false majority.
CREATE INDEX IF NOT EXISTS conversations_ai_agent_assigned_idx
  ON conversations (account_id)
  WHERE ai_agent_assigned;
