-- ============================================================
-- 121 — Tags go to the connected CRMs with the contact.
--
-- A tag added to a contact in Instant is added to the same person in
-- Zoho CRM (its own Tags) and HubSpot (an "Instant tags" checkbox
-- property, since HubSpot contacts have no tags), and removed there
-- when it is removed here.
--
-- synced_tags is what Instant last put on the CRM record. It lets the
-- push remove only tags Instant added — a tag someone set in Zoho
-- itself is never touched — and tells a tag change from no change.
-- NULL = nothing synced yet.
--
-- Tag changes do not touch the contacts row, so the contact triggers
-- (111, 120) never see them. These triggers queue the contact for both
-- CRMs when a tag is added or removed, and every carrier of a tag when
-- the tag is renamed. The enqueue functions already check whether each
-- CRM is connected, and never raise.
-- ============================================================

ALTER TABLE zoho_record_links ADD COLUMN IF NOT EXISTS synced_tags text[];
ALTER TABLE hubspot_record_links ADD COLUMN IF NOT EXISTS synced_tags text[];

CREATE OR REPLACE FUNCTION crm_contact_tags_enqueue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact uuid := COALESCE(NEW.contact_id, OLD.contact_id);
  v_account uuid;
BEGIN
  SELECT account_id INTO v_account FROM contacts WHERE id = v_contact;
  -- The contact itself is being deleted (the cascade): nothing to sync.
  IF v_account IS NULL THEN
    RETURN NULL;
  END IF;
  PERFORM zoho_enqueue(v_account, 'contact', v_contact);
  PERFORM hubspot_enqueue(v_account, 'contact', v_contact);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS contact_tags_crm_enqueue ON contact_tags;
CREATE TRIGGER contact_tags_crm_enqueue
  AFTER INSERT OR DELETE ON contact_tags
  FOR EACH ROW EXECUTE FUNCTION crm_contact_tags_enqueue();

CREATE OR REPLACE FUNCTION crm_tag_renamed_enqueue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF NEW.name IS NOT DISTINCT FROM OLD.name THEN
    RETURN NULL;
  END IF;
  FOR r IN
    SELECT c.id, c.account_id
    FROM contact_tags ct
    JOIN contacts c ON c.id = ct.contact_id
    WHERE ct.tag_id = NEW.id
  LOOP
    PERFORM zoho_enqueue(r.account_id, 'contact', r.id);
    PERFORM hubspot_enqueue(r.account_id, 'contact', r.id);
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tags_crm_renamed ON tags;
CREATE TRIGGER tags_crm_renamed
  AFTER UPDATE OF name ON tags
  FOR EACH ROW EXECUTE FUNCTION crm_tag_renamed_enqueue();
