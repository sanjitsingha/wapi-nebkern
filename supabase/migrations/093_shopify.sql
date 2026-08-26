-- ============================================================
-- 093 — Shopify integration (mirrors 092 WooCommerce)
--
-- One connection per account: the shop's .myshopify.com domain, an Admin
-- API access token, and the app's API secret key (used to verify inbound
-- webhook HMACs). Both secrets are app-encrypted before they land here.
-- Writes go through the service role; admins read their own connection,
-- any member reads recorded orders.
-- ============================================================

CREATE TABLE IF NOT EXISTS shopify_connections (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  shop_domain    text NOT NULL,          -- e.g. myshop.myshopify.com
  access_token   text NOT NULL,          -- app-encrypted (Admin API token)
  api_secret     text NOT NULL,          -- app-encrypted (for webhook HMAC)
  webhook_token  text NOT NULL UNIQUE,   -- opaque token in the receiver URL
  wc_webhook_ids jsonb NOT NULL DEFAULT '[]'::jsonb, -- ids of webhooks we created
  is_active      boolean NOT NULL DEFAULT true,
  connected_by   uuid,
  connected_at   timestamptz NOT NULL DEFAULT now(),
  last_event_at  timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shopify_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shopify_conn_select ON shopify_connections;
CREATE POLICY shopify_conn_select ON shopify_connections FOR SELECT
  USING (is_account_member(account_id, 'admin'));

CREATE INDEX IF NOT EXISTS idx_shopify_conn_token ON shopify_connections(webhook_token);

CREATE TABLE IF NOT EXISTS shopify_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  connection_id  uuid REFERENCES shopify_connections(id) ON DELETE SET NULL,
  shopify_order_id bigint NOT NULL,
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
  UNIQUE (account_id, shopify_order_id)
);

ALTER TABLE shopify_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shopify_orders_select ON shopify_orders;
CREATE POLICY shopify_orders_select ON shopify_orders FOR SELECT
  USING (is_account_member(account_id));

CREATE INDEX IF NOT EXISTS idx_shopify_orders_account ON shopify_orders(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_contact ON shopify_orders(contact_id);
