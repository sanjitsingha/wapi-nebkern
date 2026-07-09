-- ============================================================
-- 045_contact_marital.sql — Marital status + spouse on contacts
--
-- `marital_status` is free-form TEXT (the UI offers a fixed set);
-- `spouse_name` is only meaningful when married and is cleared by the
-- app otherwise. Both nullable, additive, idempotent.
-- ============================================================
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS marital_status TEXT,
  ADD COLUMN IF NOT EXISTS spouse_name    TEXT;
