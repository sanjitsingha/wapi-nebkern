-- ============================================================
-- 056_admin_notifications.sql — global / targeted announcements
--
-- Lets an operator push a notification from the admin panel that shows up
-- in tenants' header bell alongside the derived feed (unread messages, AI
-- handoffs, template verdicts, campaigns — see /api/notifications).
--
-- Audience
--   'all'      → every account sees it (a global announcement).
--   'account'  → only the named account_id sees it (a targeted notice).
--
-- Lifecycle: is_active toggles visibility without deleting; expires_at
-- (optional) auto-hides it. Both are enforced in the RLS SELECT policy so
-- the tenant feed query stays trivial.
--
-- RLS
--   SELECT: any authenticated member may read an announcement that is
--   active, not expired, and either global or scoped to an account they
--   belong to. No INSERT/UPDATE/DELETE policy — only the service-role
--   admin client writes.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text NOT NULL,
  href        text,                       -- optional in-app link
  audience    text NOT NULL DEFAULT 'all'
                CHECK (audience IN ('all', 'account')),
  account_id  uuid REFERENCES accounts(id) ON DELETE CASCADE,
  is_active   boolean NOT NULL DEFAULT true,
  expires_at  timestamptz,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- A targeted announcement must name its account; a global one must not.
  CONSTRAINT admin_notifications_audience_account_ck
    CHECK ((audience = 'all' AND account_id IS NULL)
        OR (audience = 'account' AND account_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS admin_notifications_created_at_idx
  ON admin_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_notifications_account_id_idx
  ON admin_notifications (account_id);

CREATE OR REPLACE FUNCTION public.update_admin_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_notifications_updated_at ON admin_notifications;
CREATE TRIGGER admin_notifications_updated_at
  BEFORE UPDATE ON admin_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_admin_notifications_updated_at();

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Members read active, non-expired announcements addressed to them (global
-- or their account). Writes have no policy → service-role admin only.
DROP POLICY IF EXISTS admin_notifications_select ON admin_notifications;
CREATE POLICY admin_notifications_select ON admin_notifications FOR SELECT
  USING (
    is_active
    AND (expires_at IS NULL OR expires_at > now())
    AND (audience = 'all' OR is_account_member(account_id))
  );
