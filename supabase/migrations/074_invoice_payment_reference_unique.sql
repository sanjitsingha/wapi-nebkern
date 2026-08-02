-- ============================================================
-- 074_invoice_payment_reference_unique.sql — one invoice per payment
--
-- The Razorpay verify route (src/app/api/billing/razorpay/verify) treats
-- invoices.payment_reference as its idempotency key: before activating a
-- plan it looks for an invoice already carrying that razorpay_payment_id.
--
-- That check was advisory only. Nothing in the schema stopped two rows
-- sharing a payment_reference, so two verify calls racing on the same
-- payment — a double-clicked handler, a retried fetch, Razorpay firing
-- the handler twice — could both read "no invoice yet" and both proceed,
-- billing the ledger twice and stacking two periods onto the account for
-- a single charge.
--
-- A unique index makes the second writer lose at the database instead,
-- which is the only layer that can actually see the race.
--
-- Partial (WHERE NOT NULL) because payment_reference is nullable and
-- carries free text for manually-recorded invoices: a cheque number or
-- "paid in cash" may legitimately repeat, and only the rows that have a
-- reference at all need to be distinct. NULLs are distinct in Postgres
-- unique indexes anyway, but the predicate also keeps the index small.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- If duplicates already exist this index build fails, which is the
-- correct outcome: they need reconciling by hand (a real double-charge
-- or a double-credit) before uniqueness can be asserted. Query to find
-- them:
--
--   SELECT payment_reference, count(*), array_agg(invoice_number)
--   FROM invoices
--   WHERE payment_reference IS NOT NULL
--   GROUP BY payment_reference HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_payment_reference_key
  ON invoices (payment_reference)
  WHERE payment_reference IS NOT NULL;
