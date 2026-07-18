-- ============================================================
-- 060_webhooks.sql — outbound webhooks + teardown of the old
-- appointment integration.
--
-- Part A drops account_settings (029), which only ever backed the removed
-- "appointment notification" integration. Part B adds the outbound
-- webhooks platform: per-account endpoints the tenant registers, and a
-- delivery queue the cron dispatcher drains with retries.
--
-- Events fan out to every active endpoint subscribed to the event type;
-- each delivery is HMAC-signed with the endpoint's secret so the receiver
-- can verify authenticity. This is the layer that makes the app work with
-- Zapier / Make / n8n and any custom backend.
--
-- RLS: settings-class. Members of an account read its endpoints +
-- deliveries; only admins create/update/delete endpoints. The dispatcher
-- and emit paths run under the service-role client (no auth.uid()).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ---- (A) remove the old integration's table ----------------
DROP TABLE IF EXISTS account_settings;

-- ---- (B1) endpoints ----------------------------------------
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name        text NOT NULL DEFAULT 'Webhook',
  url         text NOT NULL,
  -- HMAC signing secret, AES-256-GCM-encrypted at rest (same encrypt()
  -- as WhatsApp tokens). Decrypted at send time to sign; revealable to
  -- the account so they can verify signatures on their end.
  secret      text NOT NULL,
  -- Subscribed event types (e.g. {message.received, contact.created}).
  events      text[] NOT NULL DEFAULT '{}',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_endpoints_account_id_idx
  ON webhook_endpoints (account_id);

CREATE OR REPLACE FUNCTION public.update_webhook_endpoints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS webhook_endpoints_updated_at ON webhook_endpoints;
CREATE TRIGGER webhook_endpoints_updated_at
  BEFORE UPDATE ON webhook_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_webhook_endpoints_updated_at();

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_endpoints_select ON webhook_endpoints;
CREATE POLICY webhook_endpoints_select ON webhook_endpoints FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS webhook_endpoints_insert ON webhook_endpoints;
CREATE POLICY webhook_endpoints_insert ON webhook_endpoints FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS webhook_endpoints_update ON webhook_endpoints;
CREATE POLICY webhook_endpoints_update ON webhook_endpoints FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS webhook_endpoints_delete ON webhook_endpoints;
CREATE POLICY webhook_endpoints_delete ON webhook_endpoints FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- ---- (B2) delivery queue / log -----------------------------
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id     uuid NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_type      text NOT NULL,
  payload         jsonb NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'success', 'failed')),
  attempts        integer NOT NULL DEFAULT 0,
  response_status integer,
  error           text,
  next_retry_at   timestamptz NOT NULL DEFAULT now(),
  delivered_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- The dispatcher polls for due, still-pending rows.
CREATE INDEX IF NOT EXISTS webhook_deliveries_due_idx
  ON webhook_deliveries (next_retry_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS webhook_deliveries_account_idx
  ON webhook_deliveries (account_id, created_at DESC);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Members may read their account's delivery log (observability). Writes
-- are service-role only (emit + dispatcher), so there's no write policy.
DROP POLICY IF EXISTS webhook_deliveries_select ON webhook_deliveries;
CREATE POLICY webhook_deliveries_select ON webhook_deliveries FOR SELECT
  USING (is_account_member(account_id));
