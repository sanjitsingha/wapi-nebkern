-- ============================================================
-- 091 — audit contact tag add / remove
--
-- Tags are attached/detached via the `contact_tags` join table, written
-- straight from the RLS client, so — like contacts and deals (migration
-- 089) — this is captured in-database. The join row has no account_id of
-- its own, so we resolve it (and the contact/tag labels) from the parents.
--
-- Actor = auth.uid() (NULL for service-role writes → "System"). Best
-- effort: a logging failure never blocks the tag change.
-- ============================================================
CREATE OR REPLACE FUNCTION audit_contact_tag_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor        uuid := auth.uid();
  v_actor_name   text;
  v_contact_id   uuid;
  v_tag_id       uuid;
  v_account      uuid;
  v_contact_label text;
  v_tag_name     text;
  v_action       text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_contact_id := OLD.contact_id;
    v_tag_id     := OLD.tag_id;
    v_action     := 'contact.tag_removed';
  ELSE
    v_contact_id := NEW.contact_id;
    v_tag_id     := NEW.tag_id;
    v_action     := 'contact.tag_added';
  END IF;

  SELECT account_id, COALESCE(NULLIF(name, ''), phone)
  INTO v_account, v_contact_label
  FROM contacts
  WHERE id = v_contact_id;

  IF v_account IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT name INTO v_tag_name FROM tags WHERE id = v_tag_id;

  IF v_actor IS NOT NULL THEN
    SELECT COALESCE(NULLIF(full_name, ''), email)
    INTO v_actor_name
    FROM profiles
    WHERE user_id = v_actor;
  END IF;

  INSERT INTO audit_logs
    (account_id, actor_user_id, actor_name, action, target_type, target_id,
     target_label, metadata)
  VALUES
    (v_account, v_actor, v_actor_name, v_action, 'contact', v_contact_id::text,
     v_contact_label, jsonb_build_object('tag', v_tag_name));

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Audit logging must never break the underlying write.
  RETURN COALESCE(NEW, OLD);
END;
$$;

ALTER FUNCTION audit_contact_tag_change() OWNER TO postgres;

DROP TRIGGER IF EXISTS contact_tags_audit ON contact_tags;
CREATE TRIGGER contact_tags_audit
  AFTER INSERT OR DELETE ON contact_tags
  FOR EACH ROW EXECUTE FUNCTION audit_contact_tag_change();
