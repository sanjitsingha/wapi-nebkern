-- ============================================================
-- 092 — WooCommerce integration
--
-- One connection per account (store URL + REST API key/secret). The
-- consumer_secret is encrypted at the app layer before it lands here;
-- webhook_secret is our own HMAC key for verifying inbound order webhooks,
-- and webhook_token is the opaque id in the public receiver URL.
--
-- Writes go through the service role (the connect route + the webhook
-- receiver); there is no client write policy. Admins can READ their own
-- account's connection; any member can read recorded orders.
-- ============================================================

CREATE TABLE IF NOT EXISTS woocommerce_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  store_url       text NOT NULL,
  consumer_key    text NOT NULL,          -- Woo REST API key id
  consumer_secret text NOT NULL,          -- app-encrypted
  webhook_secret  text NOT NULL,          -- our HMAC secret for inbound verification
  webhook_token   text NOT NULL UNIQUE,   -- opaque token in the receiver URL
  wc_webhook_ids  jsonb NOT NULL DEFAULT '[]'::jsonb, -- ids of webhooks we created in Woo
  is_active       boolean NOT NULL DEFAULT true,
  connected_by    uuid,
  connected_at    timestamptz NOT NULL DEFAULT now(),
  last_event_at   timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE woocommerce_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wc_conn_select ON woocommerce_connections;
CREATE POLICY wc_conn_select ON woocommerce_connections FOR SELECT
  USING (is_account_member(account_id, 'admin'));

CREATE INDEX IF NOT EXISTS idx_wc_conn_token ON woocommerce_connections(webhook_token);

-- Recorded orders. Idempotent per (account, wc order id) so a retried
-- webhook doesn't double-insert.
CREATE TABLE IF NOT EXISTS woocommerce_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  connection_id  uuid REFERENCES woocommerce_connections(id) ON DELETE SET NULL,
  wc_order_id    bigint NOT NULL,
  contact_id     uuid REFERENCES contacts(id) ON DELETE SET NULL,
  number         text,
  status         text,
  total          numeric(12,2),
  currency       text,
  customer_name  text,
  customer_phone text,
  raw            jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, wc_order_id)
);

ALTER TABLE woocommerce_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wc_orders_select ON woocommerce_orders;
CREATE POLICY wc_orders_select ON woocommerce_orders FOR SELECT
  USING (is_account_member(account_id));

CREATE INDEX IF NOT EXISTS idx_wc_orders_account ON woocommerce_orders(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wc_orders_contact ON woocommerce_orders(contact_id);
