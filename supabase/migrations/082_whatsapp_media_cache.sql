-- ============================================================
-- 082 — remember where inbound WhatsApp media was cached
--
-- WHY THIS EXISTS
--
-- Every view of a customer-sent photo used to cost, per viewer:
--
--   1. auth.getUser()            — network call to Supabase Auth
--   2. SELECT ... FROM profiles  — to resolve the account
--   3. SELECT * FROM whatsapp_config
--   4. GET  graph.facebook.com/<media-id>      (Meta: resolve URL)
--   5. GET  <that url>                          (Meta: download bytes)
--   6. the whole binary streamed through the app server
--
-- The route sets a 24-hour Cache-Control, which hides the cost for one
-- browser — but that cache is per-device. Twenty agents opening the same
-- conversation pay all six steps twenty times, and so does every new
-- device, every incognito window and every cache clear.
--
-- With this table the first view copies the file to R2 and records where
-- it went; every later view is one indexed SELECT and a redirect. No
-- Meta calls, no token decryption, no bytes through the app, and R2
-- charges nothing for egress.
--
-- Keyed by (account_id, meta_media_id): Meta's media ids are scoped to a
-- WhatsApp Business Account, so including the account is both correct
-- and the thing that stops one tenant resolving another's media id.
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_media_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Meta's opaque media id, as it appears in the webhook payload.
  meta_media_id TEXT NOT NULL,
  -- Where we put it. `r2_path` is kept so the object can be deleted when
  -- the account is; `public_url` is what we redirect to.
  r2_path       TEXT NOT NULL,
  public_url    TEXT NOT NULL,
  content_type  TEXT,
  size_bytes    BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (account_id, meta_media_id)
);

-- The hot lookup: "have we already cached this media id for this
-- account?" — covered by the unique constraint's index.
CREATE INDEX IF NOT EXISTS idx_whatsapp_media_cache_account
  ON whatsapp_media_cache(account_id);

ALTER TABLE whatsapp_media_cache ENABLE ROW LEVEL SECURITY;

-- Single-table policy, same shape as every other tenant table since
-- migration 017 — readable by any member, written by the route under the
-- service role.
DROP POLICY IF EXISTS whatsapp_media_cache_select ON whatsapp_media_cache;
CREATE POLICY whatsapp_media_cache_select ON whatsapp_media_cache FOR SELECT USING (
  is_account_member(account_id)
);

DROP POLICY IF EXISTS whatsapp_media_cache_modify ON whatsapp_media_cache;
CREATE POLICY whatsapp_media_cache_modify ON whatsapp_media_cache FOR ALL USING (
  is_account_member(account_id, 'agent')
) WITH CHECK (
  is_account_member(account_id, 'agent')
);
