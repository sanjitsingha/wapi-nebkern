-- ============================================================
-- 055_invoices.sql — manual invoices / billing history
--
-- Builds on 054 (pricing + per-account billing). An admin records a
-- payment as an invoice against an account; the tenant sees its own
-- invoices in Settings → Plan and can open a printable copy. Still
-- MANUAL — no payment provider. When Razorpay lands, its webhook can
-- insert rows here with the same shape (amount in minor units, a status,
-- a period window), so this table is the durable billing ledger either
-- way.
--
-- Numbering
--   invoice_number is human-facing (INV-000001) and assigned by a BEFORE
--   INSERT trigger off a dedicated sequence — atomic, gap-tolerant, and
--   never colliding under concurrency.
--
-- RLS
--   SELECT: any account member may read THEIR account's invoices (the
--   Plan tab lists them). No INSERT/UPDATE/DELETE policy — invoices are
--   written only by the service-role admin client (which bypasses RLS),
--   so tenants can read but never forge or alter their own billing.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

CREATE TABLE IF NOT EXISTS invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  invoice_number    text UNIQUE,                    -- set by trigger (INV-000001)
  plan_key          text,                           -- snapshot of the billed plan, if any
  description       text NOT NULL,
  amount            integer NOT NULL CHECK (amount >= 0),   -- minor units (paise/cents)
  currency          text NOT NULL DEFAULT 'INR',
  status            text NOT NULL DEFAULT 'due'
                      CHECK (status IN ('due', 'paid', 'void')),
  period_start      timestamptz,
  period_end        timestamptz,
  issued_at         timestamptz NOT NULL DEFAULT now(),
  due_date          timestamptz,
  paid_at           timestamptz,
  payment_method    text,                           -- 'bank_transfer' | 'upi' | 'cash' | 'card' | …
  payment_reference text,                           -- txn id / cheque no / note
  notes             text,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_account_id_idx ON invoices (account_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices (status);
CREATE INDEX IF NOT EXISTS invoices_issued_at_idx ON invoices (issued_at DESC);

-- ---- invoice number + updated_at triggers ------------------
CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-' || lpad(nextval('invoice_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_set_number ON invoices;
CREATE TRIGGER invoices_set_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_invoice_number();

CREATE OR REPLACE FUNCTION public.update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_updated_at ON invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_invoices_updated_at();

-- ---- RLS ---------------------------------------------------
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Members read their own account's invoices. Writes have no policy, so
-- they're denied under RLS — only the service-role admin client writes.
DROP POLICY IF EXISTS invoices_select ON invoices;
CREATE POLICY invoices_select ON invoices FOR SELECT
  USING (is_account_member(account_id));
