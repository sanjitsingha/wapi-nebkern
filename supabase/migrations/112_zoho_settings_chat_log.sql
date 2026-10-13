-- ============================================================
-- Zoho: the connected page's settings, and WhatsApp chat logging.
--
-- Settings (all default ON, like everything else in this integration):
--   push_contacts        (existing) "Create contacts and leads in Zoho"
--   chat_contact_module  who arrives by messaging becomes a Lead or a
--                        Contact in Zoho. Leads by default.
--   log_chats            write conversations onto the person's Zoho
--                        record as notes.
--
-- Chat logging keeps one cursor per conversation (zoho_chat_logs): the
-- time of the last message already written to Zoho. The worker
-- (lib/zoho/chat-log.ts, every minute) writes what came after it once
-- the conversation has gone quiet — one note per stretch of chat, not
-- one per message, because Zoho notes can only be added (our scope is
-- notes.CREATE) and a note per message would bury the record.
-- ============================================================

ALTER TABLE zoho_connections
  ADD COLUMN IF NOT EXISTS log_chats boolean NOT NULL DEFAULT true;

ALTER TABLE zoho_connections
  ADD COLUMN IF NOT EXISTS chat_contact_module text NOT NULL DEFAULT 'Leads'
    CHECK (chat_contact_module IN ('Leads', 'Contacts'));

CREATE TABLE IF NOT EXISTS zoho_chat_logs (
  conversation_id uuid PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Messages up to and including this time are in Zoho.
  logged_until    timestamptz,
  -- Last time the worker looked, logged or not — throttles conversations
  -- it cannot log yet (the person is not in Zoho).
  checked_at      timestamptz,
  notes_created   integer NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE zoho_chat_logs ENABLE ROW LEVEL SECURITY;

-- The worker's candidate query: an account's conversations the customer
-- wrote in recently.
CREATE INDEX IF NOT EXISTS idx_conversations_account_replied
  ON conversations (account_id, customer_replied_at DESC);
