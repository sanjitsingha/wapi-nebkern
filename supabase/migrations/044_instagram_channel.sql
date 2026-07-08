-- ============================================================
-- 044_instagram_channel.sql — Instagram DM as a second channel
--
-- Adds Instagram Direct Messages as a channel alongside WhatsApp,
-- sharing the same `contacts`/`conversations`/`messages` tables
-- (channel-tagged) rather than a parallel schema. The messaging
-- pipeline itself (webhook, send route, Meta API helpers) is a
-- fully separate parallel implementation — see
-- src/app/api/instagram/ and src/lib/instagram/ — so none of the
-- 18+ existing `whatsapp_config` call sites are touched by this
-- migration or need to change.
--
-- Design notes
--   - `contacts.phone` becomes nullable: an Instagram DM contact
--     often has no phone number at all. Verified safe against the
--     existing `phone_normalized` generated column + partial unique
--     index (migration 022) — `regexp_replace(NULL, ...)` evaluates
--     to NULL, and `NULL <> ''` evaluates to NULL (not TRUE), so
--     NULL-phone rows automatically fall outside that index's WHERE
--     clause. No changes needed to migration 022's objects.
--   - `contacts.instagram_id` is the customer's IGSID
--     (Instagram-scoped id) — an exact opaque identifier, not a
--     fuzzy-matched value like phone, so no generated/normalized
--     column is needed for it.
--   - A contact row must carry at least one identity (phone or
--     instagram_id) — enforced by a CHECK constraint.
--   - `conversations.channel` defaults every existing row to
--     'whatsapp' so no backfill is required. NOTE: the existing
--     `idx_conversations_account_contact` unique index (migration
--     027, `UNIQUE(account_id, contact_id) WHERE account_id IS NOT
--     NULL`) is deliberately NOT widened to include `channel` here.
--     This is safe only because a contact's identity is
--     channel-exclusive in this MVP (a contact is created via either
--     the WhatsApp phone-match path or the Instagram instagram_id-
--     match path, never both) — so "one conversation per contact"
--     already implies "one per contact per channel". THIS INVARIANT
--     BREAKS the day cross-channel contact merging is built
--     (explicitly deferred) — revisit this index at that time.
--   - `messages` gets NO new column. The UI always has the parent
--     `conversations.channel` in hand wherever messages are
--     rendered, threaded down as a prop — duplicating a value that
--     never changes per-conversation onto every message row would
--     be pure redundancy.
--   - `instagram_config` mirrors `whatsapp_config`, simplified (no
--     phone /register+PIN dance, no WABA-subscribe step — those are
--     WhatsApp Cloud API-specific with no Instagram equivalent).
--     Follows the shared `update_updated_at_column()` trigger
--     convention from migrations 042/043 (the current majority
--     pattern), not migration 038's one-off per-table function.
--     RLS mirrors `whatsapp_config` exactly: any member reads,
--     admin+ writes.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- CONTACTS — nullable phone + instagram_id
-- ============================================================
ALTER TABLE contacts ALTER COLUMN phone DROP NOT NULL;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS instagram_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_account_instagram_id
  ON contacts (account_id, instagram_id)
  WHERE instagram_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contacts_phone_or_instagram_id_required'
  ) THEN
    ALTER TABLE contacts
      ADD CONSTRAINT contacts_phone_or_instagram_id_required
      CHECK (phone IS NOT NULL OR instagram_id IS NOT NULL);
  END IF;
END $$;

-- ============================================================
-- CONVERSATIONS — channel discriminator
-- ============================================================
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'whatsapp'
  CHECK (channel IN ('whatsapp', 'instagram'));

CREATE INDEX IF NOT EXISTS idx_conversations_account_channel
  ON conversations (account_id, channel);

-- ============================================================
-- INSTAGRAM_CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS instagram_config (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id                     UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  created_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  page_id                        TEXT NOT NULL,
  instagram_business_account_id  TEXT NOT NULL,
  access_token                   TEXT NOT NULL,
  verify_token                   TEXT,
  status                         TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
  connected_at                   TIMESTAMPTZ,
  subscribed_at                  TIMESTAMPTZ,
  last_verification_error        TEXT,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Global uniqueness, mirroring whatsapp_config.phone_number_id
-- (migration 013) — the webhook resolves the owning account by this
-- id, so two accounts claiming the same IG business account would
-- break resolution the same way issue #136 did for phone numbers.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'instagram_config_ig_business_account_id_key'
  ) THEN
    ALTER TABLE instagram_config
      ADD CONSTRAINT instagram_config_ig_business_account_id_key
      UNIQUE (instagram_business_account_id);
  END IF;
END $$;

ALTER TABLE instagram_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_config_select ON instagram_config;
CREATE POLICY instagram_config_select ON instagram_config FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS instagram_config_insert ON instagram_config;
CREATE POLICY instagram_config_insert ON instagram_config FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS instagram_config_update ON instagram_config;
CREATE POLICY instagram_config_update ON instagram_config FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS instagram_config_delete ON instagram_config;
CREATE POLICY instagram_config_delete ON instagram_config FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON instagram_config;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON instagram_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
