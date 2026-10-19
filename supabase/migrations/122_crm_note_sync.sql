-- ============================================================
-- 122 — Contact notes go to the connected CRMs.
--
-- A note written on a contact in Instant (contact_notes — the contact
-- page's Notes tab and the inbox panel's Notes) is added to the same
-- person in Zoho CRM (a Note on their Lead or Contact) and HubSpot (a
-- Note on their timeline), headed with who wrote it. Deleting it in
-- Instant deletes that copy; notes written in the CRM itself are never
-- touched.
--
-- One row per (note, CRM) in crm_note_syncs, worked by the minute cron
-- (lib/crm/note-sync.ts). It has no foreign key to contact_notes on
-- purpose: when a note is deleted, its row stays to delete the copy.
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_note_syncs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  note_id        uuid NOT NULL,
  contact_id     uuid,
  crm            text NOT NULL CHECK (crm IN ('zoho', 'hubspot')),
  -- 'create' until the note exists in the CRM; 'delete' once the note
  -- has been deleted in Instant and its copy should go too.
  action         text NOT NULL DEFAULT 'create' CHECK (action IN ('create', 'delete')),
  -- The note's id in the CRM, once created.
  remote_id      text,
  status         text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done', 'skipped', 'failed')),
  attempts       integer NOT NULL DEFAULT 0,
  next_retry_at  timestamptz NOT NULL DEFAULT now(),
  last_error     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, crm)
);
CREATE INDEX IF NOT EXISTS crm_note_syncs_due_idx
  ON crm_note_syncs (crm, next_retry_at) WHERE status = 'pending';

-- Service role only (the worker).
ALTER TABLE crm_note_syncs ENABLE ROW LEVEL SECURITY;

-- ── Queue a new note for each connected CRM ──
CREATE OR REPLACE FUNCTION crm_note_enqueue(p_account uuid, p_note uuid, p_contact uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM zoho_connections
    WHERE account_id = p_account AND is_active AND refresh_token IS NOT NULL
  ) THEN
    INSERT INTO crm_note_syncs (account_id, note_id, contact_id, crm)
    VALUES (p_account, p_note, p_contact, 'zoho')
    ON CONFLICT (note_id, crm) DO NOTHING;
  END IF;
  IF EXISTS (
    SELECT 1 FROM hubspot_connections
    WHERE account_id = p_account AND is_active AND refresh_token IS NOT NULL
  ) THEN
    INSERT INTO crm_note_syncs (account_id, note_id, contact_id, crm)
    VALUES (p_account, p_note, p_contact, 'hubspot')
    ON CONFLICT (note_id, crm) DO NOTHING;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION crm_contact_notes_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM crm_note_enqueue(NEW.account_id, NEW.id, NEW.contact_id);
    RETURN NULL;
  END IF;

  -- Deleted: copies that exist are queued for deletion; a copy never
  -- made has nothing to delete.
  UPDATE crm_note_syncs
     SET action = 'delete', status = 'pending', attempts = 0,
         next_retry_at = now(), last_error = NULL, updated_at = now()
   WHERE note_id = OLD.id AND remote_id IS NOT NULL;
  DELETE FROM crm_note_syncs WHERE note_id = OLD.id AND remote_id IS NULL;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS contact_notes_crm_sync ON contact_notes;
CREATE TRIGGER contact_notes_crm_sync
  AFTER INSERT OR DELETE ON contact_notes
  FOR EACH ROW EXECUTE FUNCTION crm_contact_notes_sync();

-- ── Backfill: every note of an account, for one CRM ──
-- Run on connect and by Resync. Notes already copied are left alone;
-- ones that were skipped (their contact was not in the CRM yet) or
-- failed get another go.
CREATE OR REPLACE FUNCTION crm_notes_backfill(p_account uuid, p_crm text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer := 0;
BEGIN
  INSERT INTO crm_note_syncs (account_id, note_id, contact_id, crm)
  SELECT n2.account_id, n2.id, n2.contact_id, p_crm
  FROM contact_notes n2
  WHERE n2.account_id = p_account
  ON CONFLICT (note_id, crm) DO UPDATE
    SET status = 'pending', attempts = 0, next_retry_at = now(), updated_at = now()
    WHERE crm_note_syncs.status IN ('skipped', 'failed')
      AND crm_note_syncs.action = 'create';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION crm_notes_backfill(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION crm_note_enqueue(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
