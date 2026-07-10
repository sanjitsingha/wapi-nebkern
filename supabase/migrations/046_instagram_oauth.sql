-- ============================================================
-- 046_instagram_oauth.sql — Instagram Business Login (OAuth) connect
--
-- Adds a one-click "Connect with Instagram" flow (Instagram API with
-- Instagram Login — https://developers.facebook.com/docs/instagram-platform)
-- alongside the existing manual Page-Access-Token entry form. Unlike
-- the manual flow, Instagram Business Login does NOT go through a
-- linked Facebook Page at all — the user logs in directly with their
-- Instagram Professional account and grants permissions, so
-- `instagram_config.page_id` (NOT NULL until now) has no value to
-- store for these rows.
--
-- `connect_method` records which flow produced the row, mainly for
-- support/debugging (the two flows mint tokens from different Meta
-- API hosts — graph.instagram.com for OAuth vs graph.facebook.com for
-- the legacy Page-token path — so knowing which one a given row used
-- matters when something needs troubleshooting).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE instagram_config ALTER COLUMN page_id DROP NOT NULL;

ALTER TABLE instagram_config
  ADD COLUMN IF NOT EXISTS connect_method TEXT NOT NULL DEFAULT 'manual'
  CHECK (connect_method IN ('manual', 'oauth'));
