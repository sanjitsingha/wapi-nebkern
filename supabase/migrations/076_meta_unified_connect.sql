-- ============================================================
-- 076_meta_unified_connect.sql — one Facebook login connects both
-- Messenger and Instagram DMs
--
-- Until now the two Meta channels were connected by two unrelated
-- flows:
--   * Messenger  — Facebook Login → a Page + its long-lived Page token
--                  (migration 066).
--   * Instagram  — Instagram Business Login → a graph.instagram.com
--                  token, with `page_id` left NULL (migration 046).
--
-- Now that this instance is an approved Meta Tech Provider, both
-- channels come out of a SINGLE Facebook Login for Business consent:
-- `GET /me/accounts` returns each Page, its Page access token, AND the
-- Instagram professional account linked to that Page, so one grant
-- yields credentials for both inboxes.
--
-- That makes the Page token the credential for Instagram too (the
-- "Instagram API with Facebook Login" path, which is what
-- src/lib/instagram/meta-api.ts already targets: it POSTs to
-- graph.facebook.com/{ig-id}/messages). Rows produced by the older
-- Instagram Business Login flow carry a graph.instagram.com token that
-- that endpoint does not accept — and a NULL `page_id`, which
-- loadInstagramAccess() treats as "not configured" — so those rows
-- could never actually send. Reconnecting through the unified flow
-- replaces them with a working Page-token row.
--
-- Changes here are additive metadata only; no data is rewritten.
--   - `connect_method` gains 'meta' so support can tell at a glance
--     which of the three flows minted a row (and therefore which Meta
--     host its token belongs to).
--   - `page_name` / `username` are display-only, so the settings UI can
--     say "Nova Store · @novastore" instead of two opaque numeric ids.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- INSTAGRAM_CONFIG — third connect method + display fields
-- ============================================================
-- Migration 046 added `connect_method` with an inline CHECK, so Postgres
-- auto-named the constraint. Rather than assume that name, drop every
-- CHECK on this table that mentions the column — there is only ever the
-- one, and this stays correct whatever it ended up called.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'instagram_config'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%connect_method%'
  LOOP
    EXECUTE format('ALTER TABLE instagram_config DROP CONSTRAINT %I', c.conname);
  END LOOP;

  ALTER TABLE instagram_config
    ADD CONSTRAINT instagram_config_connect_method_check
    CHECK (connect_method IN ('manual', 'oauth', 'meta'));
END $$;

-- Name of the Facebook Page the Instagram account is linked through.
-- Only set by the unified flow; NULL on manual / Instagram-Login rows.
ALTER TABLE instagram_config ADD COLUMN IF NOT EXISTS page_name TEXT;

-- The Instagram handle (no leading @), for display in settings and the
-- inbox. NULL when Meta did not return one.
ALTER TABLE instagram_config ADD COLUMN IF NOT EXISTS username TEXT;

-- ============================================================
-- MESSENGER_CONFIG — no schema change needed
-- ============================================================
-- The unified flow reuses `messenger_config.user_access_token` as the
-- transient parking spot for the long-lived USER token while the
-- operator picks which Page to connect. A Facebook Page is the anchor
-- of this flow (Instagram is reached THROUGH the Page), so a
-- messenger_config row always exists by the time a pick is pending —
-- no second staging table is warranted.
