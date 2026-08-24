-- ============================================================
-- 089 — audit_logs: the account-scoped activity log
--
-- Records who did what, when, from where — for every account (tenant).
-- One row per tracked event. Written ONLY by the server through the
-- service-role client (src/lib/audit/log.ts); there is deliberately no
-- INSERT/UPDATE/DELETE policy, so the log is append-only from the app's
-- point of view and immutable to any tenant, admin included. Admins of an
-- account can READ their own account's log.
--
-- `action` is free text with a dotted convention (e.g. 'member.role_changed',
-- 'contact.deleted') rather than an enum, so adding a new tracked event is a
-- code change (src/lib/audit/events.ts) with no migration. `target_id` is
-- text so it can hold a uuid, a plan key, or anything else. `metadata`
-- carries event-specific extras (old/new role, amount, etc.).
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Who performed it. NULL = a system/automated actor (cron, webhook).
  -- Not FK'd to auth.users on purpose: the log must survive the actor's
  -- deletion, and keeps src/app/admin liftable.
  actor_user_id uuid,
  actor_name    text,               -- snapshot of the actor's name at write time
  action        text NOT NULL,      -- dotted event key, e.g. 'member.removed'
  target_type   text,               -- 'member' | 'contact' | 'deal' | ...
  target_id     text,               -- uuid / key / phone, as text
  target_label  text,               -- human label snapshot (name, title, …)
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip            text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Hot path: "this account's log, newest first", optionally narrowed by
-- actor or action.
CREATE INDEX IF NOT EXISTS idx_audit_logs_account_created
  ON audit_logs(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_account_actor
  ON audit_logs(account_id, actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_account_action
  ON audit_logs(account_id, action);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins+ read their own account's log. No write policy exists, so the
-- only writer is the service-role client (which bypasses RLS) — the log
-- cannot be forged or tampered with from a tenant session.
DROP POLICY IF EXISTS audit_logs_select ON audit_logs;
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT
  USING (is_account_member(account_id, 'admin'));

-- ============================================================
-- Operational writes via DB triggers
--
-- Contacts and deals are written straight from the RLS client (no server
-- route to instrument), so they're captured in-database. `auth.uid()` is
-- the actor (NULL for service-role writes — webhook/cron — which render as
-- "System"). IP/user-agent aren't available at this layer, so they're null.
--
-- SCOPE: deals create + delete, and contact DELETE. Contact *creates* are
-- deliberately NOT logged — a bulk import would write thousands of rows and
-- drown the log. Add an INSERT trigger on contacts if that trade-off ever
-- flips.
-- ============================================================
CREATE OR REPLACE FUNCTION audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor      uuid := auth.uid();
  v_actor_name text;
  v_account    uuid;
  v_action     text;
  v_target     uuid;
  v_label      text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_account := OLD.account_id;
    v_target  := OLD.id;
  ELSE
    v_account := NEW.account_id;
    v_target  := NEW.id;
  END IF;

  IF v_account IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'contacts' THEN
    v_action := 'contact.' || CASE TG_OP WHEN 'INSERT' THEN 'created' ELSE 'deleted' END;
    v_label  := COALESCE(
                  NULLIF(CASE WHEN TG_OP = 'DELETE' THEN OLD.name ELSE NEW.name END, ''),
                  CASE WHEN TG_OP = 'DELETE' THEN OLD.phone ELSE NEW.phone END
                );
  ELSIF TG_TABLE_NAME = 'deals' THEN
    v_action := 'deal.' || CASE TG_OP WHEN 'INSERT' THEN 'created' ELSE 'deleted' END;
    v_label  := CASE WHEN TG_OP = 'DELETE' THEN OLD.title ELSE NEW.title END;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_actor IS NOT NULL THEN
    SELECT COALESCE(NULLIF(full_name, ''), email)
    INTO v_actor_name
    FROM profiles
    WHERE user_id = v_actor;
  END IF;

  INSERT INTO audit_logs
    (account_id, actor_user_id, actor_name, action, target_type, target_id, target_label)
  VALUES
    (v_account, v_actor, v_actor_name, v_action, split_part(v_action, '.', 1),
     v_target::text, v_label);

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Audit logging must never break the underlying write.
  RETURN COALESCE(NEW, OLD);
END;
$$;

ALTER FUNCTION audit_row_change() OWNER TO postgres;

DROP TRIGGER IF EXISTS deals_audit ON deals;
CREATE TRIGGER deals_audit
  AFTER INSERT OR DELETE ON deals
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

DROP TRIGGER IF EXISTS contacts_audit ON contacts;
CREATE TRIGGER contacts_audit
  AFTER DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
