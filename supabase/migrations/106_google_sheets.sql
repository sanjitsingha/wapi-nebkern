-- ============================================================
-- 106 — Google Sheets: write contacts, deal moves and campaign results
--       to a spreadsheet in the customer's own Google Drive
--
-- One platform-wide Google OAuth client (Instant's, in the same Google
-- Cloud project as "Sign in with Google"), not one per customer as Zoho
-- does: the scope is `drive.file`, which only reaches spreadsheets this
-- app created, so there is nothing for a per-tenant client to isolate,
-- and the scope needs no Google app review.
--
-- Writes go through a queue rather than straight to Google from the
-- request that caused them. A new contact arrives inside the WhatsApp
-- webhook, and a Google outage or a 2-second Sheets append must not
-- slow that down or lose the row; the queue is drained by the webhooks
-- dispatch cron (every minute), with retries.
-- ============================================================

CREATE TABLE IF NOT EXISTS google_sheets_connections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       uuid NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,

  -- Which Google account authorised it, for "Connected as …".
  google_email     text,

  -- Both app-encrypted. The refresh token is what keeps the connection
  -- alive; the access token lasts an hour and is re-minted from it.
  access_token     text,
  refresh_token    text,
  expires_at       timestamptz,

  -- The spreadsheet Instant created and writes to. Null between
  -- authorising and pressing "Add new sheet".
  spreadsheet_id   text,
  spreadsheet_url  text,
  spreadsheet_title text,

  -- What gets written. All on by default; each can be turned off.
  sync_contacts    boolean NOT NULL DEFAULT true,
  sync_deals       boolean NOT NULL DEFAULT true,
  sync_campaigns   boolean NOT NULL DEFAULT true,

  -- False until the OAuth round trip completes and a refresh token is
  -- stored. Nothing is queued for an inactive connection.
  is_active        boolean NOT NULL DEFAULT false,
  connected_by     uuid,
  connected_at     timestamptz NOT NULL DEFAULT now(),
  last_written_at  timestamptz,
  -- The last write failure, shown on the settings page so a revoked
  -- grant or a deleted spreadsheet is visible rather than silent.
  last_error       text,
  last_error_at    timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE google_sheets_connections ENABLE ROW LEVEL SECURITY;

-- Admin+, matching the other integration connections. Written only by
-- the server (service role); this is about who may see that it exists.
DROP POLICY IF EXISTS gsheets_conn_select ON google_sheets_connections;
CREATE POLICY gsheets_conn_select ON google_sheets_connections FOR SELECT
  USING (is_account_member(account_id, 'admin'));


-- Rows waiting to be appended. `tab` is the sheet tab; `payload` the
-- event as it happened (ids, a few fields). It is turned into cells when
-- the row is written, not when it is queued: that keeps the event's own
-- request to one cheap insert, and lets the writer look up stage names,
-- pipelines and contact details in a batch.
CREATE TABLE IF NOT EXISTS google_sheets_rows (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tab            text NOT NULL CHECK (tab IN ('Contacts', 'Deals', 'Campaigns')),
  payload        jsonb NOT NULL,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'done', 'failed')),
  attempts       integer NOT NULL DEFAULT 0,
  next_retry_at  timestamptz NOT NULL DEFAULT now(),
  last_error     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE google_sheets_rows ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role reads or writes the queue.

CREATE INDEX IF NOT EXISTS idx_gsheets_rows_due
  ON google_sheets_rows (next_retry_at)
  WHERE status = 'pending';


-- One row per campaign whose results have been written, so the sweep
-- never writes a campaign twice.
CREATE TABLE IF NOT EXISTS google_sheets_campaign_exports (
  broadcast_id   uuid PRIMARY KEY REFERENCES broadcasts(id) ON DELETE CASCADE,
  account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  row_count      integer NOT NULL DEFAULT 0,
  exported_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE google_sheets_campaign_exports ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.


-- When a campaign finished sending. Campaign results are written a day
-- after this, once reads and replies have had time to arrive; nothing
-- recorded the moment until now. Null for every campaign that finished
-- before this migration, which the sweep therefore never picks up.
ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS sending_finished_at timestamptz;

COMMENT ON COLUMN broadcasts.sending_finished_at IS
  'When the last send attempt finished (status became sent or failed). Null for campaigns finished before migration 106.';
