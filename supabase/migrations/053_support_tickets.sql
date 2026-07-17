-- ============================================================
-- 053_support_tickets.sql — In-app support ticketing
--
-- A lightweight helpdesk: a tenant raises a ticket from the sidebar
-- "Support" modal, and the conversation is a thread of messages. Two
-- author roles:
--   - 'user'    — written by an account member (the customer)
--   - 'support' — written by the product team, inserted server-side with
--                 the service role (bypasses RLS). Users are barred from
--                 forging a 'support' message by the messages INSERT policy.
--
-- Unread signal: `last_support_reply_at` vs `user_last_read_at` on the
-- ticket. When support has replied more recently than the user last opened
-- the ticket, the sidebar shows an alert dot. The app stamps
-- `user_last_read_at = now()` when the ticket is opened.
--
-- Design notes
--   - Account-scoped and shared across the team (one queue per account);
--     `user_id` records the author for audit and is ON DELETE SET NULL so
--     removing a teammate keeps the thread intact.
--   - `account_id` is denormalized onto messages so RLS is a direct
--     is_account_member() check rather than a parent subquery.
--   - Denormalized `last_message_at` / `last_support_reply_at` are kept
--     current by an AFTER INSERT trigger, so they stay correct even when a
--     'support' reply arrives via the service role.
--
-- Idempotent — IF NOT EXISTS throughout; policies dropped before create.
-- ============================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Creator, for audit. Nullable so deleting a user doesn't drop the ticket.
  user_id               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject               TEXT NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  category              TEXT NOT NULL DEFAULT 'general' CHECK (
                          category IN ('general', 'billing', 'technical', 'feature', 'other')
                        ),
  priority              TEXT NOT NULL DEFAULT 'normal' CHECK (
                          priority IN ('low', 'normal', 'high')
                        ),
  status                TEXT NOT NULL DEFAULT 'open' CHECK (
                          status IN ('open', 'pending', 'resolved', 'closed')
                        ),
  -- Maintained by the touch trigger below.
  last_message_at       TIMESTAMPTZ,
  last_support_reply_at TIMESTAMPTZ,
  -- Stamped by the app when the user opens the ticket; drives the unread dot.
  user_last_read_at     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_account
  ON support_tickets(account_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_account_updated
  ON support_tickets(account_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  -- Denormalized from the parent ticket so RLS stays a direct membership
  -- check; the app/service-role writer sets it to the ticket's account_id.
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  author_role TEXT NOT NULL CHECK (author_role IN ('user', 'support')),
  -- Author, for audit. NULL for 'support' messages (product team).
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket
  ON support_ticket_messages(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_account
  ON support_ticket_messages(account_id);

-- ---- Touch trigger: keep the ticket's denormalized timestamps fresh -------
-- Runs for both 'user' and 'support' inserts. A 'support' insert also
-- advances last_support_reply_at, which is what the unread dot compares
-- against user_last_read_at.
CREATE OR REPLACE FUNCTION support_ticket_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE support_tickets
     SET last_message_at = NEW.created_at,
         last_support_reply_at = CASE
           WHEN NEW.author_role = 'support' THEN NEW.created_at
           ELSE last_support_reply_at
         END,
         updated_at = NOW()
   WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_ticket_touch ON support_ticket_messages;
CREATE TRIGGER support_ticket_touch
  AFTER INSERT ON support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION support_ticket_touch();

DROP TRIGGER IF EXISTS set_updated_at ON support_tickets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---- RLS ------------------------------------------------------------------
ALTER TABLE support_tickets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Tickets: any member of the account may read, raise, and update (the
-- update path covers stamping user_last_read_at and closing a ticket).
-- Deletion is admin+ only.
DROP POLICY IF EXISTS support_tickets_select ON support_tickets;
DROP POLICY IF EXISTS support_tickets_insert ON support_tickets;
DROP POLICY IF EXISTS support_tickets_update ON support_tickets;
DROP POLICY IF EXISTS support_tickets_delete ON support_tickets;

CREATE POLICY support_tickets_select ON support_tickets FOR SELECT
  USING (is_account_member(account_id));
CREATE POLICY support_tickets_insert ON support_tickets FOR INSERT
  WITH CHECK (is_account_member(account_id));
CREATE POLICY support_tickets_update ON support_tickets FOR UPDATE
  USING (is_account_member(account_id))
  WITH CHECK (is_account_member(account_id));
CREATE POLICY support_tickets_delete ON support_tickets FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- Messages: members read the thread and post their own ('user') messages.
-- The author_role = 'user' guard means a tenant can never insert a message
-- that impersonates the support team — those arrive only via the service
-- role, which bypasses RLS. Messages are immutable (no update/delete policy).
DROP POLICY IF EXISTS support_ticket_messages_select ON support_ticket_messages;
DROP POLICY IF EXISTS support_ticket_messages_insert ON support_ticket_messages;

CREATE POLICY support_ticket_messages_select ON support_ticket_messages FOR SELECT
  USING (is_account_member(account_id));
CREATE POLICY support_ticket_messages_insert ON support_ticket_messages FOR INSERT
  WITH CHECK (is_account_member(account_id) AND author_role = 'user');

-- ---- Realtime: live unread dot on the sidebar Support button --------------
-- The useSupportUnread hook subscribes to support_tickets changes. Add the
-- table to the realtime publication (guarded/idempotent) and set REPLICA
-- IDENTITY FULL so RLS-filtered UPDATE/DELETE events carry the whole old row
-- (see migration 028 for why the partial default breaks policy evaluation).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'support_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;
  END IF;
END $$;

ALTER TABLE support_tickets REPLICA IDENTITY FULL;
