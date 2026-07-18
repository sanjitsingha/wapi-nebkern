-- ============================================================
-- 059_app_popups.sql — admin-managed splash popup on app load
--
-- A modal the tenant sees when they open the app. One flexible record
-- covers every content combination the brief asked for:
--   text, image, image + text, a YouTube video, and a link/CTA.
--
-- Audience / lifecycle mirror admin_notifications (056): 'all' vs a
-- single 'account', gated by is_active + an optional [starts_at,
-- expires_at] window, all enforced in the RLS SELECT policy. Per-popup
-- dismissal is tracked client-side (localStorage by id), so there's no
-- read-state table.
--
-- RLS
--   SELECT: any authenticated member may read a live popup addressed to
--   them. No write policy — only the service-role admin client writes.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS app_popups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text,
  body        text,
  image_url   text,
  youtube_url text,
  link_url    text,
  link_label  text,
  audience    text NOT NULL DEFAULT 'all'
                CHECK (audience IN ('all', 'account')),
  account_id  uuid REFERENCES accounts(id) ON DELETE CASCADE,
  is_active   boolean NOT NULL DEFAULT true,
  starts_at   timestamptz,
  expires_at  timestamptz,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_popups_audience_account_ck
    CHECK ((audience = 'all' AND account_id IS NULL)
        OR (audience = 'account' AND account_id IS NOT NULL)),
  -- A popup must carry at least one piece of content.
  CONSTRAINT app_popups_has_content
    CHECK (coalesce(title, '') <> ''
        OR coalesce(body, '') <> ''
        OR coalesce(image_url, '') <> ''
        OR coalesce(youtube_url, '') <> '')
);

CREATE INDEX IF NOT EXISTS app_popups_created_at_idx
  ON app_popups (created_at DESC);
CREATE INDEX IF NOT EXISTS app_popups_account_id_idx
  ON app_popups (account_id);

CREATE OR REPLACE FUNCTION public.update_app_popups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_popups_updated_at ON app_popups;
CREATE TRIGGER app_popups_updated_at
  BEFORE UPDATE ON app_popups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_app_popups_updated_at();

ALTER TABLE app_popups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_popups_select ON app_popups;
CREATE POLICY app_popups_select ON app_popups FOR SELECT
  USING (
    is_active
    AND (starts_at IS NULL OR starts_at <= now())
    AND (expires_at IS NULL OR expires_at > now())
    AND (audience = 'all' OR is_account_member(account_id))
  );
