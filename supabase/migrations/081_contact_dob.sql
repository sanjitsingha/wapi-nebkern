-- ============================================================
-- 044_contact_dob.sql — Date of birth on contacts
--
-- A first-class DATE column (not a custom field) so it can back the
-- contact Details form and, later, Segment birthday rules. Nullable;
-- additive and idempotent.
-- ============================================================
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;
