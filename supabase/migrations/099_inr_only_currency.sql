-- ============================================================
-- 099_inr_only_currency
--
-- Make INR the only deal currency.
--
-- 021 made the deal currency configurable per account, because the
-- app was self-hosted and used globally. This product is India-only:
-- it bills in INR through Razorpay and its policies cite the DPDP
-- Act. The currency pickers are therefore gone from the UI — the
-- account default (the pipeline board's Config modal), the per-deal
-- select in the deal form, and the catalog product select.
--
-- With no picker left, a row still holding 'USD' could never be
-- corrected from the app, so the existing data moves to INR here.
--
-- NOTE: this RELABELS, it does not convert. A deal saved as
-- USD 1000 becomes INR 1000 — the amount is untouched. That is the
-- intent: USD was an unwanted default, not a considered valuation.
-- An account that genuinely tracked deals in another currency has to
-- be corrected by hand, and before this runs.
--
-- Billing is deliberately untouched: billing_plans.currency,
-- accounts.billing_currency and invoices.currency all default to INR
-- already and are driven by Razorpay.
-- ============================================================

-- New accounts and new deals start in INR.
ALTER TABLE accounts ALTER COLUMN default_currency SET DEFAULT 'INR';
ALTER TABLE deals ALTER COLUMN currency SET DEFAULT 'INR';

-- Move existing rows over. `accounts.default_currency` carries a
-- 3-letter CHECK from 021, so there is nothing malformed to sanitise
-- there. `deals.currency` has no CHECK and is nullable, so it can
-- hold NULL or junk from imports — `IS DISTINCT FROM` catches both.
UPDATE accounts SET default_currency = 'INR' WHERE default_currency <> 'INR';
UPDATE deals SET currency = 'INR' WHERE currency IS DISTINCT FROM 'INR';
