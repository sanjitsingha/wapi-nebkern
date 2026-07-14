-- ============================================================
-- 052_quick_replies.sql — Canned agent replies ("quick replies")
--
-- Free-form snippets an agent fires off from the inbox by typing
-- `/shortcut`. NOT to be confused with Meta's template QUICK_REPLY
-- button type (message_templates) — these never touch Meta, they just
-- expand into the composer as ordinary text before sending.
--
-- The composer already advertised "Type '/' for quick replies" but no
-- backing feature existed; this migration adds it.
--
-- Design notes
--   - Account-scoped and SHARED across the team: one library per account,
--     not per agent. `user_id` records who created the row (audit only)
--     and is ON DELETE SET NULL so removing a teammate keeps their
--     snippets.
--   - `shortcut` is the token typed after `/`, so it must be a single
--     word — the CHECK enforces [a-z0-9_-] and the composer's regex
--     matches the same shape.
--   - UNIQUE on (account_id, lower(shortcut)) so `/Thanks` and `/thanks`
--     can't both exist and the autocomplete never has to disambiguate.
--   - RLS mirrors the operational tier (contacts/conversations): any
--     member may read; agent+ may create/edit/delete.
--
-- Idempotent — IF NOT EXISTS throughout; policies dropped before create.
-- ============================================================

CREATE TABLE IF NOT EXISTS quick_replies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Creator, for audit. Nullable so deleting a user doesn't cascade-drop
  -- a snippet the rest of the team relies on.
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  shortcut   TEXT NOT NULL CHECK (
               shortcut ~ '^[A-Za-z0-9_-]{1,32}$'
             ),
  body       TEXT NOT NULL CHECK (
               char_length(body) BETWEEN 1 AND 4096
             ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One shortcut per account, case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS idx_quick_replies_account_shortcut
  ON quick_replies(account_id, lower(shortcut));

CREATE INDEX IF NOT EXISTS idx_quick_replies_account
  ON quick_replies(account_id);

ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at ON quick_replies;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON quick_replies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---- RLS: read = any member; write = agent+ ----------------
DROP POLICY IF EXISTS quick_replies_select ON quick_replies;
DROP POLICY IF EXISTS quick_replies_insert ON quick_replies;
DROP POLICY IF EXISTS quick_replies_update ON quick_replies;
DROP POLICY IF EXISTS quick_replies_delete ON quick_replies;

CREATE POLICY quick_replies_select ON quick_replies FOR SELECT
  USING (is_account_member(account_id));
CREATE POLICY quick_replies_insert ON quick_replies FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY quick_replies_update ON quick_replies FOR UPDATE
  USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY quick_replies_delete ON quick_replies FOR DELETE
  USING (is_account_member(account_id, 'agent'));
