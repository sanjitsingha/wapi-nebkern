-- ============================================================
-- 061_app_announcements.sql — admin-managed announcement bar
--
-- A slim bar shown directly under the dashboard navbar to surface
-- important, time-boxed messages: plan-expiry reminders, scheduled
-- maintenance, a new blog post, product news/updates, etc.
--
-- One flexible record: a message, an optional link/CTA, and a
-- `variant` that drives the bar's severity styling (info / success /
-- warning / critical). Audience / lifecycle mirror app_popups (059):
-- 'all' vs a single 'account', gated by is_active + an optional
-- [starts_at, expires_at] window, all enforced in the RLS SELECT
-- policy. Per-bar dismissal is tracked client-side (localStorage by
-- id), so there's no read-state table.
--
-- RLS
--   SELECT: any authenticated member may read a live bar addressed to
--   them. No write policy — only the service-role admin client writes.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS app_announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message     text NOT NULL,
  link_url    text,
  link_label  text,
  variant     text NOT NULL DEFAULT 'info'
                CHECK (variant IN ('info', 'success', 'warning', 'critical')),
  dismissible boolean NOT NULL DEFAULT true,
  audience    text NOT NULL DEFAULT 'all'
                CHECK (audience IN ('all', 'account')),
  account_id  uuid REFERENCES accounts(id) ON DELETE CASCADE,
  is_active   boolean NOT NULL DEFAULT true,
  starts_at   timestamptz,
  expires_at  timestamptz,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_announcements_audience_account_ck
    CHECK ((audience = 'all' AND account_id IS NULL)
        OR (audience = 'account' AND account_id IS NOT NULL)),
  -- A bar must carry a non-empty message.
  CONSTRAINT app_announcements_has_message
    CHECK (coalesce(message, '') <> '')
);

CREATE INDEX IF NOT EXISTS app_announcements_created_at_idx
  ON app_announcements (created_at DESC);
CREATE INDEX IF NOT EXISTS app_announcements_account_id_idx
  ON app_announcements (account_id);

CREATE OR REPLACE FUNCTION public.update_app_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_announcements_updated_at ON app_announcements;
CREATE TRIGGER app_announcements_updated_at
  BEFORE UPDATE ON app_announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_app_announcements_updated_at();

ALTER TABLE app_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_announcements_select ON app_announcements;
CREATE POLICY app_announcements_select ON app_announcements FOR SELECT
  USING (
    is_active
    AND (starts_at IS NULL OR starts_at <= now())
    AND (expires_at IS NULL OR expires_at > now())
    AND (audience = 'all' OR is_account_member(account_id))
  );
