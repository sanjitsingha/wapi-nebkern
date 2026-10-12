-- ============================================================
-- Automatic Zoho sync: Instant subscribes to Zoho's Notification API
-- at connect time, so an admin no longer has to build a Workflow Rule
-- by hand before anything arrives.
--
-- A Zoho notification channel expires after a week at most, so it is
-- renewed by /api/integrations/zoho/cron. These columns are that
-- channel's state. All nullable or defaulted: a row from before this
-- migration simply has no channel yet, and the cron sets one up once
-- the connection carries the notifications scope (a reconnect).
--
-- The manual Workflow Rule path is untouched — it still posts to the
-- same webhook URL, and still works with auto_sync switched off.
-- ============================================================

ALTER TABLE zoho_connections
  ADD COLUMN IF NOT EXISTS auto_sync boolean NOT NULL DEFAULT true;

-- Zoho watch event names, e.g. Leads.create, Deals.edit. Only new
-- leads and contacts by default: an edit event fires on every field
-- change, and subscribing to those unasked would run automations far
-- more often than anyone expects.
ALTER TABLE zoho_connections
  ADD COLUMN IF NOT EXISTS watch_events text[] NOT NULL
    DEFAULT ARRAY['Leads.create', 'Contacts.create'];

-- The channel id we chose (Zoho wants a number), and the verification
-- token Zoho echoes back on every notification.
ALTER TABLE zoho_connections ADD COLUMN IF NOT EXISTS watch_channel_id text;
ALTER TABLE zoho_connections ADD COLUMN IF NOT EXISTS watch_token text;
ALTER TABLE zoho_connections ADD COLUMN IF NOT EXISTS watch_expires_at timestamptz;

-- Why the last attempt to set up or renew the channel failed, shown in
-- Settings. NULL when the channel is healthy.
ALTER TABLE zoho_connections ADD COLUMN IF NOT EXISTS watch_error text;

-- When we last tried, so a connection that cannot subscribe (a free
-- Zoho edition, or a token without the scope) is retried daily rather
-- than every hour.
ALTER TABLE zoho_connections ADD COLUMN IF NOT EXISTS watch_checked_at timestamptz;

COMMENT ON COLUMN zoho_connections.auto_sync IS
  'Subscribe to Zoho notifications automatically. Off = manual Workflow Rules only.';
COMMENT ON COLUMN zoho_connections.watch_expires_at IS
  'When the Zoho notification channel lapses. Renewed by the zoho cron well before.';
