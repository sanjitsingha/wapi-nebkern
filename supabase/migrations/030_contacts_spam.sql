-- ============================================================
-- 030_contacts_spam.sql — "Mark as Spam" flag on contacts
--
-- Adds a per-contact spam flag, toggled from the inbox contact
-- detail panel. Account members (agent+) can flip it via the
-- existing contacts_update RLS policy (migration 017) — no new
-- policy needed.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS is_spam BOOLEAN NOT NULL DEFAULT false;

-- Partial index so a future "hide spam" filter stays cheap; only
-- indexes the (typically small) set of flagged contacts.
CREATE INDEX IF NOT EXISTS contacts_is_spam_idx
  ON contacts(account_id)
  WHERE is_spam;
