-- ============================================================
-- 098 — audit log expansion
--
-- Broadens the activity log (089/091) to cover the events an operator
-- actually asks about: tag & custom-field definitions, contact edits,
-- WhatsApp calls, and failed message sends (the "errors" that matter —
-- a message that didn't reach the customer).
--
-- Same design as 089/091: every writer is a DB trigger, so RLS-client
-- writes are captured in-database with no per-call-site instrumentation.
-- `auth.uid()` is the actor (NULL for service-role writes — webhook/cron
-- — which render as "System"). All logging is best-effort: a failure in
-- the audit path never blocks the underlying write.
--
-- audit_logs.action is free text (089), so these new dotted keys need no
-- schema change — only matching labels in src/lib/audit/events.ts.
-- ============================================================

-- Shared: resolve an actor's display-name snapshot. Inlined per function
-- (each trigger stays standalone), factored here as a helper to avoid
-- repeating the profiles lookup five times.
CREATE OR REPLACE FUNCTION audit_actor_name(p_actor uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF p_actor IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT COALESCE(NULLIF(full_name, ''), email)
  INTO v_name
  FROM profiles
  WHERE user_id = p_actor;
  RETURN v_name;
END;
$$;
ALTER FUNCTION audit_actor_name(uuid) OWNER TO postgres;

-- ============================================================
-- tags — created / deleted
-- Defining a tag (Settings → Tags) is distinct from attaching one to a
-- contact (091). Attach/detach stay under the 'contacts' category; the
-- definition itself is logged here.
-- ============================================================
CREATE OR REPLACE FUNCTION audit_tag_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor   uuid := auth.uid();
  v_account uuid;
  v_action  text;
  v_label   text;
  v_color   text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_account := OLD.account_id;
    v_action  := 'tag.deleted';
    v_label   := OLD.name;
    v_color   := OLD.color;
  ELSE
    v_account := NEW.account_id;
    v_action  := 'tag.created';
    v_label   := NEW.name;
    v_color   := NEW.color;
  END IF;

  IF v_account IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO audit_logs
    (account_id, actor_user_id, actor_name, action, target_type, target_id,
     target_label, metadata)
  VALUES
    (v_account, v_actor, audit_actor_name(v_actor), v_action, 'tag',
     COALESCE(NEW.id, OLD.id)::text, v_label,
     jsonb_build_object('color', v_color));

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$$;
ALTER FUNCTION audit_tag_change() OWNER TO postgres;

DROP TRIGGER IF EXISTS tags_audit ON tags;
CREATE TRIGGER tags_audit
  AFTER INSERT OR DELETE ON tags
  FOR EACH ROW EXECUTE FUNCTION audit_tag_change();

-- ============================================================
-- custom_fields — created / deleted
-- ============================================================
CREATE OR REPLACE FUNCTION audit_custom_field_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor   uuid := auth.uid();
  v_account uuid;
  v_action  text;
  v_label   text;
  v_type    text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_account := OLD.account_id;
    v_action  := 'field.deleted';
    v_label   := OLD.field_name;
    v_type    := OLD.field_type;
  ELSE
    v_account := NEW.account_id;
    v_action  := 'field.created';
    v_label   := NEW.field_name;
    v_type    := NEW.field_type;
  END IF;

  IF v_account IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO audit_logs
    (account_id, actor_user_id, actor_name, action, target_type, target_id,
     target_label, metadata)
  VALUES
    (v_account, v_actor, audit_actor_name(v_actor), v_action, 'field',
     COALESCE(NEW.id, OLD.id)::text, v_label,
     jsonb_build_object('type', v_type));

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$$;
ALTER FUNCTION audit_custom_field_change() OWNER TO postgres;

DROP TRIGGER IF EXISTS custom_fields_audit ON custom_fields;
CREATE TRIGGER custom_fields_audit
  AFTER INSERT OR DELETE ON custom_fields
  FOR EACH ROW EXECUTE FUNCTION audit_custom_field_change();

-- ============================================================
-- contacts — updated
--
-- Only the human-meaningful profile fields count: an edit to name, phone,
-- email or company is logged; a bump to avatar_url, last-seen, or any
-- machine-written column is not (that noise would drown the log — the
-- same reason 089 skips contact INSERT). metadata.fields lists what
-- actually changed.
-- ============================================================
CREATE OR REPLACE FUNCTION audit_contact_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor  uuid := auth.uid();
  v_fields text[] := ARRAY[]::text[];
BEGIN
  IF NEW.account_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.name IS DISTINCT FROM OLD.name THEN
    v_fields := array_append(v_fields, 'name');
  END IF;
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    v_fields := array_append(v_fields, 'phone');
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    v_fields := array_append(v_fields, 'email');
  END IF;
  IF NEW.company IS DISTINCT FROM OLD.company THEN
    v_fields := array_append(v_fields, 'company');
  END IF;

  -- Nothing meaningful moved — stay quiet.
  IF array_length(v_fields, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO audit_logs
    (account_id, actor_user_id, actor_name, action, target_type, target_id,
     target_label, metadata)
  VALUES
    (NEW.account_id, v_actor, audit_actor_name(v_actor), 'contact.updated',
     'contact', NEW.id::text,
     COALESCE(NULLIF(NEW.name, ''), NEW.phone),
     jsonb_build_object('fields', to_jsonb(v_fields)));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
ALTER FUNCTION audit_contact_update() OWNER TO postgres;

DROP TRIGGER IF EXISTS contacts_update_audit ON contacts;
CREATE TRIGGER contacts_update_audit
  AFTER UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION audit_contact_update();

-- ============================================================
-- call_logs — finalized calls
--
-- The webhook UPSERTs: the 'connect' event opens the row at 'ringing',
-- the 'terminate' event finalizes it. Only the finalized state is worth a
-- log line, so this fires when status lands on a terminal value (on the
-- terminate UPDATE, or an INSERT that already arrives terminal) — never
-- for the transient 'ringing' row. Actor is System (service-role writer).
-- ============================================================
CREATE OR REPLACE FUNCTION audit_call_finalized()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text;
BEGIN
  IF NEW.status NOT IN ('completed', 'missed', 'declined', 'failed') THEN
    RETURN NEW;
  END IF;
  -- On UPDATE, only when the status actually transitioned into terminal,
  -- so a later duration/updated_at write doesn't log the call twice.
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.account_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.contact_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(name, ''), phone)
    INTO v_label
    FROM contacts
    WHERE id = NEW.contact_id;
  END IF;

  INSERT INTO audit_logs
    (account_id, actor_user_id, actor_name, action, target_type, target_id,
     target_label, metadata)
  VALUES
    (NEW.account_id, NULL, NULL, 'call.' || NEW.status, 'call',
     NEW.id::text, COALESCE(v_label, 'Unknown number'),
     jsonb_build_object(
       'direction', NEW.direction,
       'duration_seconds', NEW.duration_seconds
     ));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
ALTER FUNCTION audit_call_finalized() OWNER TO postgres;

DROP TRIGGER IF EXISTS call_logs_audit ON call_logs;
CREATE TRIGGER call_logs_audit
  AFTER INSERT OR UPDATE ON call_logs
  FOR EACH ROW EXECUTE FUNCTION audit_call_finalized();

-- ============================================================
-- messages — failed sends  (the "errors" surface)
--
-- A message landing on status='failed' carries the Meta / send error in
-- error_message (096). That is exactly the error an operator needs to
-- see, so it becomes an audit line the moment it happens — whether the
-- row is inserted failed or transitions to failed on a status callback.
-- Actor is usually System (the webhook writes the delivery status).
-- ============================================================
CREATE OR REPLACE FUNCTION audit_message_failed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.status <> 'failed' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'failed' THEN
    RETURN NEW;  -- already logged when it first failed
  END IF;
  IF NEW.account_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO audit_logs
    (account_id, actor_user_id, actor_name, action, target_type, target_id,
     target_label, metadata)
  VALUES
    (NEW.account_id, v_actor, audit_actor_name(v_actor), 'message.failed',
     'message', NEW.id::text,
     LEFT(COALESCE(NULLIF(NEW.error_message, ''), NEW.content_text, 'Message failed'), 140),
     jsonb_build_object(
       'error', NEW.error_message,
       'conversation_id', NEW.conversation_id,
       'content_type', NEW.content_type
     ));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
ALTER FUNCTION audit_message_failed() OWNER TO postgres;

DROP TRIGGER IF EXISTS messages_failed_audit ON messages;
CREATE TRIGGER messages_failed_audit
  AFTER INSERT OR UPDATE OF status ON messages
  FOR EACH ROW EXECUTE FUNCTION audit_message_failed();
