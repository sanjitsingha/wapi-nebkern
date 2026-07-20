-- ============================================================
-- 066_messenger_channel.sql — Facebook Messenger as a third channel
--
-- Adds Facebook Messenger alongside WhatsApp and Instagram (migration
-- 044), sharing the same contacts / conversations / messages tables
-- (channel-tagged) rather than a parallel schema. The messaging
-- pipeline itself (OAuth, config, webhook, send route, Meta helpers)
-- is a fully separate parallel implementation under
-- src/app/api/messenger/ and src/lib/messenger/, so no existing
-- WhatsApp/Instagram call sites are touched.
--
-- Design notes (mirrors 044 exactly, one channel over):
--   - `contacts.messenger_id` is the customer's PSID (Page-Scoped ID)
--     — an opaque exact identifier like instagram_id, so no
--     generated/normalized column is needed.
--   - The identity CHECK is widened: a contact must carry at least one
--     of phone / instagram_id / messenger_id.
--   - `conversations.channel` CHECK gains 'messenger'.
--   - `messenger_config` mirrors `instagram_config` but is Page-based
--     (Facebook Login → a Page + its long-lived Page access token).
--     Two extra columns support the connect flow:
--       * `page_name`          — shown in the settings UI.
--       * `user_access_token`  — the long-lived USER token, stored only
--         transiently while the operator picks which Page to connect
--         (a user may manage several). Cleared once a Page is chosen.
--     Both `page_id` and `access_token` are nullable so a half-finished
--     "picking a page" row can exist; a fully connected row has both.
--   - RLS mirrors instagram_config exactly: any member reads, admin+
--     writes. Tokens are encrypted at the app layer (AES-256-GCM),
--     same as whatsapp_config / instagram_config.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- CONTACTS — messenger_id (PSID) + widened identity CHECK
-- ============================================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS messenger_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_account_messenger_id
  ON contacts (account_id, messenger_id)
  WHERE messenger_id IS NOT NULL;

-- Replace the two-way identity CHECK (migration 044) with a three-way
-- one. Drop the old, add the new under a fresh name.
ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS contacts_phone_or_instagram_id_required;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_identity_required'
  ) THEN
    ALTER TABLE contacts
      ADD CONSTRAINT contacts_identity_required
      CHECK (phone IS NOT NULL OR instagram_id IS NOT NULL OR messenger_id IS NOT NULL);
  END IF;
END $$;

-- ============================================================
-- CONVERSATIONS — widen channel discriminator
-- ============================================================
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_channel_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_channel_check
  CHECK (channel IN ('whatsapp', 'instagram', 'messenger'));

-- ============================================================
-- MESSENGER_CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS messenger_config (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id               UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  created_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  page_id                  TEXT,
  page_name                TEXT,
  access_token             TEXT,             -- encrypted long-lived Page token
  user_access_token        TEXT,             -- encrypted long-lived USER token (transient, during page pick)
  verify_token             TEXT,
  connect_method           TEXT NOT NULL DEFAULT 'oauth' CHECK (connect_method IN ('oauth', 'manual')),
  status                   TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
  connected_at             TIMESTAMPTZ,
  subscribed_at            TIMESTAMPTZ,
  last_verification_error  TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Global Page uniqueness (partial — a "picking a page" row has no
-- page_id yet). Mirrors instagram_config's uniqueness on the business
-- account id: the webhook resolves the owning account by page_id, so
-- two accounts claiming the same Page would break resolution.
CREATE UNIQUE INDEX IF NOT EXISTS idx_messenger_config_page_id
  ON messenger_config (page_id)
  WHERE page_id IS NOT NULL;

ALTER TABLE messenger_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messenger_config_select ON messenger_config;
CREATE POLICY messenger_config_select ON messenger_config FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS messenger_config_insert ON messenger_config;
CREATE POLICY messenger_config_insert ON messenger_config FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS messenger_config_update ON messenger_config;
CREATE POLICY messenger_config_update ON messenger_config FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS messenger_config_delete ON messenger_config;
CREATE POLICY messenger_config_delete ON messenger_config FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON messenger_config;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON messenger_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
