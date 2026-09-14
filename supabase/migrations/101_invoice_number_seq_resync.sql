-- ============================================================
-- 101_invoice_number_seq_resync
--
-- set_invoice_number() (055) numbers invoices from invoice_number_seq.
-- When the database moved from the Tokyo project to Mumbai the invoice
-- ROWS came across but the sequence's position did not: it restarted at
-- 1 while INV-000001 … INV-000005 already existed.
--
-- From then on every new invoice failed on invoices_invoice_number_key.
-- That covered manual invoices from the admin panel, and Razorpay's —
-- which logs the failure and carries on, so a paying customer would be
-- activated with no invoice on record.
--
-- 1. Move the sequence past the highest number in use. Never backwards,
--    so running this against an already-fixed database is a no-op.
-- 2. Make the trigger skip a number that is already taken. The sequence
--    alone can't be trusted to stay ahead of the table across a restore
--    or a copy — this is the second time a data move has broken it — so
--    the trigger checks instead of assuming.
-- ============================================================

SELECT setval(
  'invoice_number_seq',
  GREATEST(
    COALESCE(
      (SELECT MAX(substring(invoice_number FROM '([0-9]+)$')::bigint) FROM invoices),
      0
    ),
    (SELECT last_value FROM invoice_number_seq)
  ),
  true
);

CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  candidate TEXT;
BEGIN
  IF NEW.invoice_number IS NULL THEN
    LOOP
      candidate := 'INV-' || lpad(nextval('invoice_number_seq')::text, 6, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM invoices WHERE invoice_number = candidate
      );
    END LOOP;
    NEW.invoice_number := candidate;
  END IF;
  RETURN NEW;
END;
$$;
