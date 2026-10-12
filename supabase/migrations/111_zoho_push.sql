-- ============================================================
-- Instant → Zoho: push contacts and deals into Zoho CRM.
--
-- ── Why database triggers ──
--
-- Contacts and deals are written from a dozen places: the browser
-- (manual add/edit, CSV import, the deal form — straight through RLS),
-- every channel webhook, the public API, the integrations. Almost none
-- of them emit an event. Hooking each one in app code would miss
-- writes silently, which for a sync is the one unacceptable failure.
-- A trigger sees every write, whoever made it.
--
-- The triggers only ENQUEUE (zoho_sync_queue). The Zoho calls happen
-- in the worker (lib/zoho/push.ts, drained every minute), so a slow or
-- failing Zoho never slows down or fails a contact save.
--
-- Never deletes anything in Zoho: a deleted Instant contact or deal
-- just drops its link.
-- ============================================================

-- How a contact came to exist. Only 'conversation' changes anything
-- today: those become Zoho Leads (an unqualified prospect who messaged
-- you); everyone else becomes a Zoho Contact. NULL = added by hand,
-- imported, or created before this column existed.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS created_via text;
COMMENT ON COLUMN contacts.created_via IS
  'Origin of the contact: conversation | api | zoho | NULL (manual, import, or older).';

-- Per-connection switches, and the deal stages read from the Zoho org.
ALTER TABLE zoho_connections ADD COLUMN IF NOT EXISTS push_contacts boolean NOT NULL DEFAULT true;
ALTER TABLE zoho_connections ADD COLUMN IF NOT EXISTS push_deals boolean NOT NULL DEFAULT true;
ALTER TABLE zoho_connections ADD COLUMN IF NOT EXISTS deal_stages jsonb;
ALTER TABLE zoho_connections ADD COLUMN IF NOT EXISTS deal_stages_at timestamptz;

-- ── Which Zoho record each Instant record is ──
CREATE TABLE IF NOT EXISTS zoho_record_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entity       text NOT NULL CHECK (entity IN ('contact', 'deal')),
  local_id     uuid NOT NULL,
  zoho_module  text NOT NULL CHECK (zoho_module IN ('Leads', 'Contacts', 'Deals')),
  zoho_id      text NOT NULL,
  -- Fingerprint of the fields last written to (or read from) Zoho. A
  -- change whose fingerprint matches is an echo and is not pushed.
  synced_hash  text,
  -- When Instant last wrote this record. A Zoho event for it shortly
  -- after is our own change coming back, and must not run automations.
  pushed_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, entity, local_id),
  UNIQUE (account_id, zoho_module, zoho_id)
);
CREATE INDEX IF NOT EXISTS zoho_record_links_zoho_idx ON zoho_record_links (account_id, zoho_id);

-- ── Work to do ──
CREATE TABLE IF NOT EXISTS zoho_sync_queue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entity        text NOT NULL CHECK (entity IN ('contact', 'deal')),
  local_id      uuid NOT NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed', 'skipped')),
  attempts      integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- One pending row per record: ten edits in a minute are one push of
-- the latest state, not ten.
CREATE UNIQUE INDEX IF NOT EXISTS zoho_sync_queue_pending_uniq
  ON zoho_sync_queue (entity, local_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS zoho_sync_queue_due_idx
  ON zoho_sync_queue (next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS zoho_sync_queue_account_idx
  ON zoho_sync_queue (account_id, status, updated_at DESC);

-- Service role only (the worker); members read the queue through the
-- settings API, which also uses the service role after its own auth.
ALTER TABLE zoho_record_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoho_sync_queue ENABLE ROW LEVEL SECURITY;

-- ── Enqueue ──
-- SECURITY DEFINER because most writes arrive through a member's RLS
-- session, which has no rights on the queue. Never raises: a sync
-- problem must not be able to fail the user's save.
CREATE OR REPLACE FUNCTION zoho_enqueue(p_account uuid, p_entity text, p_local uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM zoho_connections c
    WHERE c.account_id = p_account
      AND c.is_active
      AND c.refresh_token IS NOT NULL
      AND (CASE WHEN p_entity = 'contact' THEN c.push_contacts ELSE c.push_deals END)
  ) THEN
    RETURN;
  END IF;

  INSERT INTO zoho_sync_queue (account_id, entity, local_id)
  VALUES (p_account, p_entity, p_local)
  ON CONFLICT (entity, local_id) WHERE status = 'pending'
  DO UPDATE SET next_retry_at = LEAST(zoho_sync_queue.next_retry_at, now()),
                updated_at = now();
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION zoho_contacts_enqueue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND
     NEW.name IS NOT DISTINCT FROM OLD.name AND
     NEW.phone IS NOT DISTINCT FROM OLD.phone AND
     NEW.email IS NOT DISTINCT FROM OLD.email AND
     NEW.company IS NOT DISTINCT FROM OLD.company THEN
    RETURN NEW;
  END IF;
  PERFORM zoho_enqueue(NEW.account_id, 'contact', NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION zoho_deals_enqueue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND
     NEW.title IS NOT DISTINCT FROM OLD.title AND
     NEW.value IS NOT DISTINCT FROM OLD.value AND
     NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id AND
     NEW.status IS NOT DISTINCT FROM OLD.status AND
     NEW.contact_id IS NOT DISTINCT FROM OLD.contact_id AND
     NEW.expected_close_date IS NOT DISTINCT FROM OLD.expected_close_date THEN
    RETURN NEW;
  END IF;
  PERFORM zoho_enqueue(NEW.account_id, 'deal', NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zoho_contacts_enqueue ON contacts;
CREATE TRIGGER zoho_contacts_enqueue
  AFTER INSERT OR UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION zoho_contacts_enqueue();

DROP TRIGGER IF EXISTS zoho_deals_enqueue ON deals;
CREATE TRIGGER zoho_deals_enqueue
  AFTER INSERT OR UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION zoho_deals_enqueue();

-- Deleted records drop their link (the Zoho record stays).
CREATE OR REPLACE FUNCTION zoho_unlink_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM zoho_record_links
  WHERE account_id = OLD.account_id
    AND entity = TG_ARGV[0]
    AND local_id = OLD.id;
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS zoho_contacts_unlink ON contacts;
CREATE TRIGGER zoho_contacts_unlink
  AFTER DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION zoho_unlink_deleted('contact');

DROP TRIGGER IF EXISTS zoho_deals_unlink ON deals;
CREATE TRIGGER zoho_deals_unlink
  AFTER DELETE ON deals
  FOR EACH ROW EXECUTE FUNCTION zoho_unlink_deleted('deal');

-- ── Backfill: queue every existing contact (and optionally deal) ──
-- Called from Settings → "Sync existing". Rows already linked and
-- unchanged are no-ops in the worker, so running it twice is harmless.
CREATE OR REPLACE FUNCTION zoho_backfill(p_account uuid, p_deals boolean DEFAULT true)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer := 0;
  m integer := 0;
BEGIN
  INSERT INTO zoho_sync_queue (account_id, entity, local_id)
  SELECT c.account_id, 'contact', c.id
  FROM contacts c
  WHERE c.account_id = p_account
    AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
  ON CONFLICT (entity, local_id) WHERE status = 'pending' DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;

  IF p_deals THEN
    INSERT INTO zoho_sync_queue (account_id, entity, local_id)
    SELECT d.account_id, 'deal', d.id
    FROM deals d
    WHERE d.account_id = p_account
    ON CONFLICT (entity, local_id) WHERE status = 'pending' DO NOTHING;
    GET DIAGNOSTICS m = ROW_COUNT;
  END IF;

  RETURN n + m;
END;
$$;

REVOKE ALL ON FUNCTION zoho_backfill(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION zoho_enqueue(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
