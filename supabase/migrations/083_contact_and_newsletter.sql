-- ============================================================
-- 083 — public contact form + newsletter signups
--
-- WHY THIS EXISTS
--
-- Two write surfaces open to anonymous visitors on the marketing site:
-- the contact form and the newsletter box. Everything else in this
-- schema belongs to a tenant `account`; these two do not. Nobody has
-- signed up yet — that is the entire point of the form — so there is no
-- account_id to scope a row to, and no tenant may ever read them. They
-- belong to the operator, and are read only through the admin panel's
-- service-role client.
--
-- WHY RLS IS ON WITH NO POLICIES
--
-- RLS enabled and zero policies means anon and authenticated can do
-- nothing at all: no select, no insert, no update. That is deliberate.
-- Writes arrive through /api/contact and /api/newsletter, which run on
-- the server, verify a captcha first, and use the service-role key —
-- which bypasses RLS. So the only path into these tables is the one
-- that does the spam checking.
--
-- The alternative — an anon INSERT policy so the browser could write
-- directly — would let anyone with the public anon key (it ships in the
-- client bundle, by design) POST unlimited rows straight to Postgres,
-- skipping the captcha entirely. A form that can be filled by curl is
-- a spam table with extra steps.
-- ============================================================

-- ── Contact form ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_submissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  -- Optional: plenty of enquiries come from people who would rather be
  -- emailed back, and a required phone field costs more submissions
  -- than the number is worth.
  phone      TEXT,
  company    TEXT,
  message    TEXT NOT NULL,

  -- Triage state for the operator. No enum type: this is a
  -- back-office workflow that will grow states, and adding one to a
  -- CHECK is a one-line migration where adding one to an enum is not.
  status     TEXT NOT NULL DEFAULT 'new'
             CHECK (status IN ('new', 'read', 'replied', 'spam')),
  notes      TEXT,

  -- Kept for abuse triage — which page it came from, and enough of the
  -- request to recognise a flood from one source. Not used for
  -- analytics; see the Privacy Policy before it becomes so.
  source_path TEXT,
  user_agent  TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The admin list is "newest first", always.
CREATE INDEX IF NOT EXISTS contact_submissions_created_idx
  ON contact_submissions (created_at DESC);

-- Partial index: the default filter is "unhandled", which is a small
-- slice of the table once it has been running a while.
CREATE INDEX IF NOT EXISTS contact_submissions_status_idx
  ON contact_submissions (status, created_at DESC)
  WHERE status IN ('new', 'read');

ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- ── Newsletter ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Lowercased by the API before insert so the unique index actually
  -- catches "Sam@x.com" after "sam@x.com".
  email          TEXT NOT NULL,
  -- Optional by design: asking for a name to send a newsletter is a
  -- field people abandon the form over.
  name           TEXT,

  -- Unsubscribes are a state change, never a delete: a deleted row
  -- re-subscribes silently the next time the address is entered, and
  -- "we have no record of you asking us to stop" is not a defence.
  status         TEXT NOT NULL DEFAULT 'subscribed'
                 CHECK (status IN ('subscribed', 'unsubscribed')),
  unsubscribed_at TIMESTAMPTZ,

  source_path    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per address. The API upserts on this, so a second signup
-- from the same person is not an error and not a duplicate.
--
-- A plain column index, not `lower(email)`: PostgREST's `on_conflict`
-- names columns, and cannot target an expression index — an upsert
-- against one fails at runtime. Case is handled where the only writer
-- is, which lowercases before insert (see /api/newsletter). Nothing
-- else can write here; RLS has no policies.
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_key
  ON newsletter_subscribers (email);

CREATE INDEX IF NOT EXISTS newsletter_subscribers_created_idx
  ON newsletter_subscribers (created_at DESC);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- ── updated_at on contact rows ────────────────────────────────
CREATE OR REPLACE FUNCTION touch_contact_submissions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_submissions_touch ON contact_submissions;
CREATE TRIGGER contact_submissions_touch
  BEFORE UPDATE ON contact_submissions
  FOR EACH ROW
  EXECUTE FUNCTION touch_contact_submissions_updated_at();
