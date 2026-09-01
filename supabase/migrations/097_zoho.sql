  -- ============================================================
  -- 097 — Zoho CRM: let CRM events drive WhatsApp messaging
  --
  -- Not a record sync. Zoho stays the system of record for sales; this
  -- connection exists so a change THERE can send a message from HERE — a
  -- deal reaching "Quotation" sends the quote template, an invoice going
  -- overdue sends a reminder, a new lead gets a welcome.
  --
  -- Which events matter is decided in Zoho, in a Workflow Rule pointed at
  -- our receiver URL. That is deliberate: Zoho already has a mature rule
  -- builder over every module and field, including custom ones, and
  -- rebuilding a worse version of it here would have been the larger part
  -- of this work.
  --
  -- Events arrive at /api/integrations/zoho/webhook/[token] and fire the
  -- `zoho_event` automation trigger with the record's fields as
  -- {{vars.*}}.
  -- ============================================================

  CREATE TABLE IF NOT EXISTS zoho_connections (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id     uuid NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,

    -- The customer's OWN Zoho client, not ours.
    --
    -- Per-account rather than one platform-wide app in the environment,
    -- which is how woocommerce_connections already stores consumer_key /
    -- consumer_secret. A single shared client would mean every customer's
    -- CRM access hanging off one registration we control: one revocation,
    -- one rate limit, or one region mismatch takes down every tenant at
    -- once. It also cannot work across Zoho data centres, since a client
    -- registered on .com is unknown to .in.
    --
    -- The admin registers a Server-based Application in their own Zoho
    -- API Console and pastes the pair here. `client_secret` is
    -- app-encrypted before it lands.
    client_id      text NOT NULL,
    client_secret  text NOT NULL,

    -- Zoho is region-partitioned: a token minted in the EU data centre is
    -- rejected by the US API and vice versa. The domain is captured at
    -- connect time and every later call is built from it, rather than
    -- assuming .com and failing confusingly for everyone else.
    api_domain     text NOT NULL DEFAULT 'https://www.zohoapis.com',
    accounts_url   text NOT NULL DEFAULT 'https://accounts.zoho.com',

    -- Both app-encrypted. The refresh token is the long-lived one and is
    -- what makes this connection survive; the access token expires in an
    -- hour and is re-minted from it.
    --
    -- Nullable because the row is written BEFORE the OAuth round trip —
    -- it is where the client id and secret live while the admin is away
    -- at Zoho's consent screen. A connection with a NULL refresh_token is
    -- half-made, which is what `is_active` distinguishes.
    access_token   text,
    refresh_token  text,
    -- When the current access token dies. Checked before every call so a
    -- refresh happens ahead of a 401 rather than in response to one.
    expires_at     timestamptz,

    -- Opaque token in the receiver URL — this is what identifies the
    -- account on an inbound event, since a Zoho Workflow Rule cannot sign
    -- its payload.
    webhook_token  text NOT NULL UNIQUE,

    -- Org details, for showing WHICH Zoho is connected.
    org_id         text,
    org_name       text,

    -- False until the OAuth round trip completes. The webhook receiver
    -- checks this, so a half-made connection cannot accept events.
    is_active      boolean NOT NULL DEFAULT false,
    connected_by   uuid,
    connected_at   timestamptz NOT NULL DEFAULT now(),
    last_event_at  timestamptz,
    updated_at     timestamptz NOT NULL DEFAULT now()
  );

  ALTER TABLE zoho_connections ENABLE ROW LEVEL SECURITY;

  -- Admin+, matching the other integration connections. The tokens are
  -- write-once from the server anyway (service role), so this policy is
  -- about who can SEE that a connection exists and its org name.
  DROP POLICY IF EXISTS zoho_conn_select ON zoho_connections;
  CREATE POLICY zoho_conn_select ON zoho_connections FOR SELECT
    USING (is_account_member(account_id, 'admin'));

  CREATE INDEX IF NOT EXISTS idx_zoho_conn_token
    ON zoho_connections(webhook_token);

  -- ── Received events ─────────────────────────────────────────────────
  --
  -- Every inbound event, kept whether or not it matched a contact.
  --
  -- This is the debugging surface. A Zoho Workflow Rule that fires but
  -- sends the wrong field, or a payload with no phone in it, is otherwise
  -- invisible: the automation simply never runs and there is nothing to
  -- look at. Storing the raw payload turns "it didn't work" into
  -- something answerable.
  CREATE TABLE IF NOT EXISTS zoho_events (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    connection_id uuid REFERENCES zoho_connections(id) ON DELETE SET NULL,

    -- What Zoho called it. Free text: the Workflow Rule sets this, so it
    -- is whatever the person configuring it chose ("deal_won",
    -- "invoice_overdue"). Used as a {{vars.event}} and for filtering.
    event_type    text,
    -- Zoho module the record came from (Deals, Leads, Contacts, …).
    module        text,
    -- The record's id in Zoho, for building a link back.
    record_id     text,

    contact_id    uuid REFERENCES contacts(id) ON DELETE SET NULL,
    -- NULL when the payload carried no usable phone. The row still
    -- exists, which is the point.
    matched       boolean NOT NULL DEFAULT false,
    skip_reason   text,

    payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at    timestamptz NOT NULL DEFAULT now()
  );

  ALTER TABLE zoho_events ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS zoho_events_select ON zoho_events;
  CREATE POLICY zoho_events_select ON zoho_events FOR SELECT
    USING (is_account_member(account_id));

  CREATE INDEX IF NOT EXISTS idx_zoho_events_account
    ON zoho_events(account_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_zoho_events_contact
    ON zoho_events(contact_id);
