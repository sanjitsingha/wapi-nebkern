-- ============================================================
-- 120 — HubSpot: the same two-way sync Zoho CRM has (097–112).
--
--   Connect   one click: OAuth against Instant's own HubSpot app
--             (HUBSPOT_CLIENT_ID / HUBSPOT_CLIENT_SECRET on the server).
--   Instant → HubSpot
--             contacts and deals, queued by the triggers below and
--             pushed by lib/hubspot/push.ts every minute; WhatsApp
--             chats logged on the contact's timeline by
--             lib/hubspot/chat-log.ts.
--   HubSpot → Instant
--             the app's webhook subscriptions (one URL for every
--             connected portal, signed with the client secret) arrive at
--             /api/integrations/hubspot/webhook, are stored here, and
--             run `hubspot_event` automations.
--
-- Unlike Zoho there is no notification channel to subscribe or renew:
-- HubSpot webhooks belong to the app and reach every portal that
-- installs it.
-- ============================================================

CREATE TABLE IF NOT EXISTS hubspot_connections (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            uuid NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,

  -- The HubSpot account (portal) — what webhook events are addressed
  -- to. Not unique: two Instant accounts may connect the same portal,
  -- and each gets the events.
  portal_id             text,
  hub_domain            text,
  -- Where the portal's web app lives: app.hubspot.com, or
  -- app-eu1.hubspot.com for an EU-hosted one. Record links use it.
  ui_domain             text NOT NULL DEFAULT 'app.hubspot.com',

  -- App-encrypted. Access tokens last 30 minutes and are re-minted from
  -- the refresh token. Nullable: the row exists from the moment the
  -- admin is sent to HubSpot, before any token does.
  access_token          text,
  refresh_token         text,
  expires_at            timestamptz,
  scopes                text[],

  -- False until the OAuth round trip completes; the webhook ignores
  -- events for a connection that is not active.
  is_active             boolean NOT NULL DEFAULT false,

  -- Settings (all on by default, like Zoho's).
  push_contacts         boolean NOT NULL DEFAULT true,
  push_deals            boolean NOT NULL DEFAULT true,
  log_chats             boolean NOT NULL DEFAULT true,
  -- The lifecycle stage someone who arrived by messaging gets when they
  -- are created in HubSpot. Everyone else is created without one.
  chat_lifecycle_stage  text NOT NULL DEFAULT 'lead'
    CHECK (chat_lifecycle_stage IN ('subscriber', 'lead', 'marketingqualifiedlead', 'salesqualifiedlead')),

  -- The portal's deal pipeline and its stages, cached a day — HubSpot
  -- rejects a stage id it does not have.
  deal_pipeline         jsonb,
  deal_pipeline_at      timestamptz,

  connected_by          uuid,
  connected_at          timestamptz NOT NULL DEFAULT now(),
  last_event_at         timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hubspot_connections ENABLE ROW LEVEL SECURITY;

-- Admin+ may see that a connection exists. Every write is the server's
-- (service role).
DROP POLICY IF EXISTS hubspot_conn_select ON hubspot_connections;
CREATE POLICY hubspot_conn_select ON hubspot_connections FOR SELECT
  USING (is_account_member(account_id, 'admin'));

CREATE INDEX IF NOT EXISTS idx_hubspot_conn_portal ON hubspot_connections(portal_id);

-- ── Received events ─────────────────────────────────────────────────
--
-- HubSpot gives a webhook five seconds and batches up to 100 events per
-- request, so the receiver only stores them (one row per connected
-- account) and answers; they are worked through right after the
-- response and, failing that, by the minute cron. Kept a month, as the
-- debugging surface for "why didn't my automation run".
CREATE TABLE IF NOT EXISTS hubspot_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  connection_id      uuid REFERENCES hubspot_connections(id) ON DELETE SET NULL,

  -- HubSpot retries and can deliver an event twice, and its eventId is
  -- not guaranteed unique. This key (subscription, object, property,
  -- time) is.
  dedupe_key         text NOT NULL,

  subscription_type  text,
  object_type        text CHECK (object_type IN ('contact', 'deal')),
  object_id          text,
  property_name      text,
  property_value     text,
  occurred_at        timestamptz,

  -- What automations see as {{vars.hubspot_event}}: contact.created,
  -- deal.stage_changed, deal.won… Set once processed.
  event_type         text,
  contact_id         uuid REFERENCES contacts(id) ON DELETE SET NULL,
  matched            boolean NOT NULL DEFAULT false,
  skip_reason        text,

  status             text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done', 'skipped', 'failed')),
  attempts           integer NOT NULL DEFAULT 0,
  last_error         text,

  payload            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  processed_at       timestamptz,
  UNIQUE (account_id, dedupe_key)
);

ALTER TABLE hubspot_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hubspot_events_select ON hubspot_events;
CREATE POLICY hubspot_events_select ON hubspot_events FOR SELECT
  USING (is_account_member(account_id));

CREATE INDEX IF NOT EXISTS idx_hubspot_events_account
  ON hubspot_events(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hubspot_events_pending
  ON hubspot_events(created_at) WHERE status = 'pending';

-- ── Which HubSpot record each Instant record is ──
CREATE TABLE IF NOT EXISTS hubspot_record_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entity          text NOT NULL CHECK (entity IN ('contact', 'deal')),
  local_id        uuid NOT NULL,
  hubspot_object  text NOT NULL CHECK (hubspot_object IN ('contacts', 'deals')),
  hubspot_id      text NOT NULL,
  -- Fingerprint of the fields last written to (or read from) HubSpot; a
  -- change with the same fingerprint is an echo and is not pushed.
  synced_hash     text,
  -- When Instant last wrote this record. A HubSpot event for it shortly
  -- after is our own change coming back and runs no automations.
  pushed_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, entity, local_id),
  UNIQUE (account_id, hubspot_object, hubspot_id)
);
CREATE INDEX IF NOT EXISTS hubspot_record_links_hs_idx
  ON hubspot_record_links (account_id, hubspot_id);

-- ── Work to do (Instant → HubSpot) ──
CREATE TABLE IF NOT EXISTS hubspot_sync_queue (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entity         text NOT NULL CHECK (entity IN ('contact', 'deal')),
  local_id       uuid NOT NULL,
  status         text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done', 'failed', 'skipped')),
  attempts       integer NOT NULL DEFAULT 0,
  next_retry_at  timestamptz NOT NULL DEFAULT now(),
  last_error     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
-- One pending row per record: ten edits in a minute are one push.
CREATE UNIQUE INDEX IF NOT EXISTS hubspot_sync_queue_pending_uniq
  ON hubspot_sync_queue (entity, local_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS hubspot_sync_queue_due_idx
  ON hubspot_sync_queue (next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS hubspot_sync_queue_account_idx
  ON hubspot_sync_queue (account_id, status, updated_at DESC);

-- ── Chat logging cursor, one per conversation ──
CREATE TABLE IF NOT EXISTS hubspot_chat_logs (
  conversation_id  uuid PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  account_id       uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Messages up to and including this time are on the HubSpot timeline.
  logged_until     timestamptz,
  -- Last time the worker looked, logged or not.
  checked_at       timestamptz,
  entries_created  integer NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Service role only: the worker, and the settings API after its own
-- auth check.
ALTER TABLE hubspot_record_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubspot_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubspot_chat_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN contacts.created_via IS
  'Origin of the contact: conversation | api | zoho | hubspot | NULL (manual, import, or older).';

-- ── Enqueue ──
-- SECURITY DEFINER because most writes arrive through a member's RLS
-- session, which has no rights on the queue. Never raises: a sync
-- problem must not fail the user's save.
CREATE OR REPLACE FUNCTION hubspot_enqueue(p_account uuid, p_entity text, p_local uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM hubspot_connections c
    WHERE c.account_id = p_account
      AND c.is_active
      AND c.refresh_token IS NOT NULL
      AND (CASE WHEN p_entity = 'contact' THEN c.push_contacts ELSE c.push_deals END)
  ) THEN
    RETURN;
  END IF;

  INSERT INTO hubspot_sync_queue (account_id, entity, local_id)
  VALUES (p_account, p_entity, p_local)
  ON CONFLICT (entity, local_id) WHERE status = 'pending'
  DO UPDATE SET next_retry_at = LEAST(hubspot_sync_queue.next_retry_at, now()),
                updated_at = now();
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION hubspot_contacts_enqueue()
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
  PERFORM hubspot_enqueue(NEW.account_id, 'contact', NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION hubspot_deals_enqueue()
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
  PERFORM hubspot_enqueue(NEW.account_id, 'deal', NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hubspot_contacts_enqueue ON contacts;
CREATE TRIGGER hubspot_contacts_enqueue
  AFTER INSERT OR UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION hubspot_contacts_enqueue();

DROP TRIGGER IF EXISTS hubspot_deals_enqueue ON deals;
CREATE TRIGGER hubspot_deals_enqueue
  AFTER INSERT OR UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION hubspot_deals_enqueue();

-- Deleted records drop their link; the HubSpot record stays.
CREATE OR REPLACE FUNCTION hubspot_unlink_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM hubspot_record_links
  WHERE account_id = OLD.account_id
    AND entity = TG_ARGV[0]
    AND local_id = OLD.id;
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS hubspot_contacts_unlink ON contacts;
CREATE TRIGGER hubspot_contacts_unlink
  AFTER DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION hubspot_unlink_deleted('contact');

DROP TRIGGER IF EXISTS hubspot_deals_unlink ON deals;
CREATE TRIGGER hubspot_deals_unlink
  AFTER DELETE ON deals
  FOR EACH ROW EXECUTE FUNCTION hubspot_unlink_deleted('deal');

-- ── Backfill: queue every existing contact (and optionally deal) ──
-- Run on connect and by Resync. Linked, unchanged records are no-ops
-- in the worker, so running it twice is harmless.
CREATE OR REPLACE FUNCTION hubspot_backfill(p_account uuid, p_deals boolean DEFAULT true)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer := 0;
  m integer := 0;
BEGIN
  INSERT INTO hubspot_sync_queue (account_id, entity, local_id)
  SELECT c.account_id, 'contact', c.id
  FROM contacts c
  WHERE c.account_id = p_account
    AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
  ON CONFLICT (entity, local_id) WHERE status = 'pending' DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;

  IF p_deals THEN
    INSERT INTO hubspot_sync_queue (account_id, entity, local_id)
    SELECT d.account_id, 'deal', d.id
    FROM deals d
    WHERE d.account_id = p_account
    ON CONFLICT (entity, local_id) WHERE status = 'pending' DO NOTHING;
    GET DIAGNOSTICS m = ROW_COUNT;
  END IF;

  RETURN n + m;
END;
$$;

REVOKE ALL ON FUNCTION hubspot_backfill(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION hubspot_enqueue(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
