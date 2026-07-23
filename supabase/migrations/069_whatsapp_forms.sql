-- ============================================================
-- 069_whatsapp_forms.sql — Native WhatsApp Flows ("Forms")
--
-- Called "Forms" in the product (not "Flows") to avoid colliding with
-- the existing Flows bot-builder feature (migration 010) — these are
-- two unrelated things that happen to share Meta's name for one of
-- them. A wacrm Form maps 1:1 to a Meta WhatsApp Flow object.
--
-- Scope: STATIC flows only (fixed screens, no live backend data
-- mid-flow) — no `endpoint_uri`, no data-exchange encryption. A form
-- is always exactly one screen: a set of input fields plus a submit
-- button that completes the flow and delivers the answers back via
-- webhook (`interactive.nfm_reply`).
--
-- `fields` is wacrm's own simplified authoring shape (what the builder
-- UI edits); `flow_json` is the Meta Flow JSON generated from it and
-- actually uploaded to Meta — kept alongside for support/debugging
-- without needing to regenerate or re-fetch it.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_forms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  categories        TEXT[] NOT NULL DEFAULT '{OTHER}',
  fields            JSONB NOT NULL DEFAULT '[]',
  flow_json         JSONB,
  meta_flow_id      TEXT,
  -- Mirrors Meta's own Flow status enum exactly (DRAFT | PUBLISHED |
  -- DEPRECATED | BLOCKED | THROTTLED) rather than inventing a
  -- parallel one — this value is written straight from Meta's
  -- response, not computed locally.
  status            TEXT NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT', 'PUBLISHED', 'DEPRECATED', 'BLOCKED', 'THROTTLED')),
  validation_errors JSONB NOT NULL DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_forms_account ON whatsapp_forms(account_id);

-- A Meta flow_id, once assigned, is globally unique — but null while
-- still being created (the very first Meta call can fail after the
-- local row exists in rarer partial-failure paths), so this is a
-- partial index rather than a plain UNIQUE column constraint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_forms_meta_flow_id
  ON whatsapp_forms(meta_flow_id)
  WHERE meta_flow_id IS NOT NULL;

ALTER TABLE whatsapp_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_forms_select ON whatsapp_forms;
CREATE POLICY whatsapp_forms_select ON whatsapp_forms FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS whatsapp_forms_insert ON whatsapp_forms;
CREATE POLICY whatsapp_forms_insert ON whatsapp_forms FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS whatsapp_forms_update ON whatsapp_forms;
CREATE POLICY whatsapp_forms_update ON whatsapp_forms FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS whatsapp_forms_delete ON whatsapp_forms;
CREATE POLICY whatsapp_forms_delete ON whatsapp_forms FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON whatsapp_forms;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON whatsapp_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MESSAGES — a flow's completed-form answers, rendered in the thread
-- ============================================================
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_content_type_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_content_type_check
  CHECK (content_type IN (
    'text', 'image', 'document', 'audio', 'video', 'location',
    'template', 'interactive', 'call', 'form_response'
  ));

-- Which form a given outbound message sent, and which form a given
-- inbound form_response answers — both nullable, only one populated
-- per row. Lets the inbox thread show the response with a live link
-- back to its form even if the form is later renamed.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS whatsapp_form_id UUID
  REFERENCES whatsapp_forms(id) ON DELETE SET NULL;

-- The customer's submitted answers on a form_response row, keyed by
-- field LABEL where the originating form could be resolved (via
-- flow_token below) and by raw field id otherwise. Rendered as a
-- small table in the inbox rather than a single content_text line.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS form_answers JSONB;

-- The opaque flow_token generated per send (src/lib/whatsapp/forms.ts
-- sendFlowMessage). Meta echoes it back unchanged in the nfm_reply
-- completion webhook, which is otherwise identified only by the
-- customer's phone number — with this, the webhook can look back up
-- WHICH form (of possibly several sent to the same contact) a given
-- response answers, rather than assuming "their most recent form".
ALTER TABLE messages ADD COLUMN IF NOT EXISTS flow_token TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_flow_token
  ON messages(flow_token)
  WHERE flow_token IS NOT NULL;
