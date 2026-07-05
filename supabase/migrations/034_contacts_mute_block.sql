-- ============================================================
-- 034_contacts_mute_block.sql — mute & block flags on contacts
--
-- Adds the two remaining per-contact status flags surfaced by the
-- contact detail header's actions menu (mute / report spam / block).
-- `is_spam` already exists (migration 030); this adds `is_muted` and
-- `is_blocked`.
--
--   - is_muted   → suppress notifications for this contact
--   - is_blocked → contact is blocked; used to hide/skip them
--
-- Account members (agent+) can flip both through the existing
-- contacts_update RLS policy (migration 017) — no new policy needed.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS is_muted   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false;

-- Partial index so a future "hide blocked" filter stays cheap; only
-- indexes the (typically small) set of blocked contacts.
CREATE INDEX IF NOT EXISTS contacts_is_blocked_idx
  ON contacts(account_id)
  WHERE is_blocked;
