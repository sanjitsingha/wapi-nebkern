-- ============================================================
-- 050_call_logs.sql — WhatsApp Business Calling (Layer A: call log)
--
-- Records inbound (and, later, outbound) WhatsApp voice-call events
-- delivered on the webhook's `calls` field. Layer A does NOT answer
-- calls (that's the WebRTC softphone, Layer B) — it enables calling on
-- the number, receives the connect/terminate events, and logs them so
-- the business can see when customers tried to call.
--
-- Design notes
--   - Account-scoped, read-only in the app: any member can SELECT;
--     there are no INSERT/UPDATE/DELETE policies because the ONLY writer
--     is the webhook, which uses the service-role client (bypasses RLS).
--     Mirrors automation_logs (migration 017): logs are observed, never
--     hand-edited. This also means no client can forge a call record.
--   - `wa_call_id` is Meta's call id. UNIQUE(account_id, wa_call_id) so
--     the webhook can UPSERT: the `connect` event creates the row, the
--     later `terminate` event finalizes it (status/duration/ended_at)
--     without racing to a duplicate, and redelivered events are no-ops.
--   - conversation_id / contact_id are nullable FKs (ON DELETE SET NULL)
--     so purging a contact or conversation doesn't cascade-delete the
--     historical call record.
--   - `status` is kept as free TEXT (no CHECK): the exact set of
--     terminate statuses Meta emits for this new API isn't nailed down
--     yet, and a too-strict CHECK would drop real events. `raw` keeps the
--     full webhook object for forensics / fields we don't model yet.
--   - `created_by` deliberately absent — calls originate from Meta, not
--     a user.
--
-- Also widens messages.content_type to allow 'call', so a finalized call
-- shows inline in the existing inbox thread as a normal message row
-- (rendered as a call chip) without a separate timeline merge.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS call_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id  UUID REFERENCES conversations(id) ON DELETE SET NULL,
  contact_id       UUID REFERENCES contacts(id) ON DELETE SET NULL,
  wa_call_id       TEXT NOT NULL,
  direction        TEXT NOT NULL DEFAULT 'inbound'
                     CHECK (direction IN ('inbound', 'outbound')),
  -- e.g. 'ringing' (connect seen, not yet ended), 'completed', 'missed',
  -- 'declined', 'failed'. Free text on purpose — see banner.
  status           TEXT NOT NULL DEFAULT 'ringing',
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  duration_seconds INTEGER,
  raw              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, wa_call_id)
);

CREATE INDEX IF NOT EXISTS idx_call_logs_account_created
  ON call_logs(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_conversation
  ON call_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_contact
  ON call_logs(contact_id);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Read-only in the app; writes are service-role only (webhook).
DROP POLICY IF EXISTS call_logs_select ON call_logs;
CREATE POLICY call_logs_select ON call_logs FOR SELECT
  USING (is_account_member(account_id));

DROP TRIGGER IF EXISTS set_updated_at ON call_logs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON call_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Allow 'call' as a message content_type so finalized calls appear
-- inline in the inbox thread. Widens the CHECK last set in migration
-- 010 (which added 'interactive'); re-added here with 'call'.
-- ============================================================
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_content_type_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_content_type_check
  CHECK (content_type IN (
    'text', 'image', 'document', 'audio', 'video',
    'location', 'template', 'interactive', 'call'
  ));
