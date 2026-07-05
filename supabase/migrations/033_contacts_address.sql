-- ============================================================
-- 033_contacts_address.sql — structured postal address on contacts
--
-- Adds the address fields shown in the contact Details tab: street,
-- locality, city, state, pin code. Stored as separate nullable TEXT
-- columns (rather than one JSON blob) so they stay queryable/filterable
-- later and map cleanly to individual form inputs.
--
-- Account members (agent+) can read/write them through the existing
-- contacts_update / contacts_select RLS policies (migration 017) — no
-- new policy needed.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS street   TEXT,
  ADD COLUMN IF NOT EXISTS locality TEXT,
  ADD COLUMN IF NOT EXISTS city     TEXT,
  ADD COLUMN IF NOT EXISTS state    TEXT,
  ADD COLUMN IF NOT EXISTS pin_code TEXT;
