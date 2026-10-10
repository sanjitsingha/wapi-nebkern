-- ============================================================
-- 107 — Google Sheets: several accounts, several sheets, one kind of
--       entry per sheet
--
-- 106 allowed one Google account and one three-tab spreadsheet per
-- workspace. The settings page now lists every connected sheet and adds
-- them one at a time: pick (or add) a Google account, then choose the
-- ONE kind of entry the sheet receives — new contacts, incoming
-- messages, conversation assignments, deal stage changes, or campaign
-- results. One kind per sheet keeps every sheet a single clean table
-- with one header row, which is what people filter, chart and share.
--
--   google_accounts  each Google account an admin authorised; the
--                    tokens live here, shared by that account's sheets
--   google_sheets    each spreadsheet Instant created, and its kind
--
-- The 106 Google account is carried over (no need to sign in again).
-- Its three-tab test spreadsheet is not: it stays in that Drive, and
-- sheets are added afresh through the new dialog. The 106 queue and
-- export log only ever held that sheet's rows, so they are rebuilt per
-- sheet rather than migrated.
-- ============================================================

CREATE TABLE IF NOT EXISTS google_accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  google_email   text NOT NULL,
  -- Both app-encrypted. The refresh token keeps the account usable; the
  -- access token lasts an hour and is re-minted from it.
  access_token   text,
  refresh_token  text,
  expires_at     timestamptz,
  -- False once Google rejects the grant (revoked, password reset): its
  -- sheets stop until the admin reconnects the account.
  is_active      boolean NOT NULL DEFAULT true,
  connected_by   uuid,
  connected_at   timestamptz NOT NULL DEFAULT now(),
  last_error     text,
  last_error_at  timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- Authorising the same Google account again refreshes this row.
  UNIQUE (account_id, google_email)
);

ALTER TABLE google_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS google_accounts_select ON google_accounts;
CREATE POLICY google_accounts_select ON google_accounts FOR SELECT
  USING (is_account_member(account_id, 'admin'));


CREATE TABLE IF NOT EXISTS google_sheets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Removing a Google account removes the sheets that wrote through it
  -- (the spreadsheets themselves stay in that person's Drive).
  google_account_id  uuid NOT NULL REFERENCES google_accounts(id) ON DELETE CASCADE,
  -- The one kind of entry this sheet receives (src/lib/google-sheets/rows.ts).
  event_type         text NOT NULL CHECK (event_type IN
                       ('contacts', 'messages', 'assignments', 'deals', 'campaigns')),
  spreadsheet_id     text NOT NULL,
  spreadsheet_url    text NOT NULL,
  title              text NOT NULL,
  -- Paused sheets keep their place in the list but receive nothing.
  is_active          boolean NOT NULL DEFAULT true,
  created_by         uuid,
  -- Campaigns that finished sending before this are never exported to
  -- the sheet: it starts from the day it was added.
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_written_at    timestamptz,
  last_error         text,
  last_error_at      timestamptz
);

ALTER TABLE google_sheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS google_sheets_select ON google_sheets;
CREATE POLICY google_sheets_select ON google_sheets FOR SELECT
  USING (is_account_member(account_id, 'admin'));

CREATE INDEX IF NOT EXISTS idx_google_sheets_account
  ON google_sheets (account_id, event_type)
  WHERE is_active;


-- ── Carry over the 106 Google account ─────────────────────────────
INSERT INTO google_accounts (
  account_id, google_email, access_token, refresh_token, expires_at,
  is_active, connected_by, connected_at
)
SELECT
  account_id, COALESCE(google_email, 'Google account'), access_token,
  refresh_token, expires_at, is_active, connected_by, connected_at
FROM google_sheets_connections
WHERE refresh_token IS NOT NULL
ON CONFLICT (account_id, google_email) DO NOTHING;


-- ── Queue and export log, now per sheet ────────────────────────────
DROP TABLE IF EXISTS google_sheets_rows;
CREATE TABLE google_sheets_rows (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  sheet_id       uuid NOT NULL REFERENCES google_sheets(id) ON DELETE CASCADE,
  -- The event as it happened (ids, a few fields). Turned into cells
  -- when written, so the event's own request stays one cheap insert.
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

DROP TABLE IF EXISTS google_sheets_campaign_exports;
CREATE TABLE google_sheets_campaign_exports (
  sheet_id       uuid NOT NULL REFERENCES google_sheets(id) ON DELETE CASCADE,
  broadcast_id   uuid NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  row_count      integer NOT NULL DEFAULT 0,
  exported_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sheet_id, broadcast_id)
);
ALTER TABLE google_sheets_campaign_exports ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.

DROP TABLE IF EXISTS google_sheets_connections;
