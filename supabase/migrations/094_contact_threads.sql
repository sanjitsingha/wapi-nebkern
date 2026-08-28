-- ============================================================
-- 094 — Team Inbox: an internal thread per contact, with @mentions
--
-- The sidebar's "Notes" were one-line comments with no reply, no
-- addressee and no way to know one had been left. This turns that into
-- a conversation scoped to a single contact: anyone on the account can
-- post, mention a colleague, and the colleague is told.
--
-- Two tables rather than one. Mentions could live as a uuid[] on the
-- message, but then "what am I mentioned in" is a scan of every message
-- on the account, and marking one read means rewriting the message row
-- that other people are also reading. A row per (message, member) is
-- indexable, per-user readable, and per-user writable.
--
-- Existing contact_notes are migrated in at the bottom and the table is
-- left in place — see the note there.
-- ============================================================

-- ── The thread ──────────────────────────────────────────────────────
--
-- No `thread` table: the contact IS the thread. A separate parent row
-- would need creating on first post, would need its own RLS, and would
-- answer no question that `WHERE contact_id = …` does not.
CREATE TABLE IF NOT EXISTS contact_thread_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  -- The author. Kept even if they leave the account: their messages
  -- stay, attributed, the way a chat history should behave.
  author_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (length(trim(body)) > 0),
  -- Soft delete. A hard DELETE would take the mention rows with it and
  -- silently empty someone's notification; this keeps the row and lets
  -- the UI render "message deleted" in place.
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contact_thread_messages ENABLE ROW LEVEL SECURITY;

-- Everyone on the account can read the whole thread. That is the point
-- of a team inbox — a private internal conversation would be a DM
-- feature, which this is not.
DROP POLICY IF EXISTS ctm_select ON contact_thread_messages;
CREATE POLICY ctm_select ON contact_thread_messages FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS ctm_insert ON contact_thread_messages;
CREATE POLICY ctm_insert ON contact_thread_messages FOR INSERT
  WITH CHECK (is_account_member(account_id) AND author_id = auth.uid());

-- Edit and delete are the author's alone. An admin override sounds
-- reasonable until you picture someone rewriting a colleague's words in
-- a record that gets read as testimony about a customer.
DROP POLICY IF EXISTS ctm_update ON contact_thread_messages;
CREATE POLICY ctm_update ON contact_thread_messages FOR UPDATE
  USING (is_account_member(account_id) AND author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ctm_contact
  ON contact_thread_messages(contact_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ctm_account
  ON contact_thread_messages(account_id, created_at DESC);

-- ── Mentions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_thread_mentions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES contact_thread_messages(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  -- Who was tagged.
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Mentioning the same person twice in one message is one mention.
  UNIQUE (message_id, user_id)
);

ALTER TABLE contact_thread_mentions ENABLE ROW LEVEL SECURITY;

-- You can see the mentions addressed to you. Not everyone's: the bell
-- count is a personal number, and a member reading another member's
-- unread mentions is a privacy leak with no feature behind it.
DROP POLICY IF EXISTS ctmention_select ON contact_thread_mentions;
CREATE POLICY ctmention_select ON contact_thread_mentions FOR SELECT
  USING (is_account_member(account_id) AND user_id = auth.uid());

-- Written by the author of the message, for someone else.
DROP POLICY IF EXISTS ctmention_insert ON contact_thread_mentions;
CREATE POLICY ctmention_insert ON contact_thread_mentions FOR INSERT
  WITH CHECK (
    is_account_member(account_id)
    AND EXISTS (
      SELECT 1 FROM contact_thread_messages m
      WHERE m.id = message_id AND m.author_id = auth.uid()
    )
  );

-- Marking read is the only update, and only your own.
DROP POLICY IF EXISTS ctmention_update ON contact_thread_mentions;
CREATE POLICY ctmention_update ON contact_thread_mentions FOR UPDATE
  USING (is_account_member(account_id) AND user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- The bell's query: my unread mentions, newest first.
CREATE INDEX IF NOT EXISTS idx_ctmention_unread
  ON contact_thread_mentions(user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ctmention_message
  ON contact_thread_mentions(message_id);

-- ── Realtime ────────────────────────────────────────────────────────
--
-- Both tables, so an open thread updates as colleagues type and the
-- bell badge moves the moment someone is tagged rather than on the
-- feed's three-minute poll.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE contact_thread_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE contact_thread_mentions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ── Migrate the old notes ───────────────────────────────────────────
--
-- Every existing note becomes the first message in its contact's
-- thread, keeping its author and its timestamp so the history reads
-- correctly rather than all landing "just now".
--
-- contact_notes is NOT dropped. The data is copied, not moved, and the
-- table stays until this has been in production long enough to trust —
-- a drop in the same migration as the copy leaves no way back if the
-- copy was wrong. A later migration removes it.
INSERT INTO contact_thread_messages (
  account_id, contact_id, author_id, body, created_at, updated_at
)
SELECT
  n.account_id,
  n.contact_id,
  n.user_id,
  n.note_text,
  n.created_at,
  n.created_at
FROM contact_notes n
WHERE n.account_id IS NOT NULL
  AND n.user_id IS NOT NULL
  AND length(trim(coalesce(n.note_text, ''))) > 0
  -- Re-runnable: skip anything already carried across.
  AND NOT EXISTS (
    SELECT 1 FROM contact_thread_messages m
    WHERE m.contact_id = n.contact_id
      AND m.author_id = n.user_id
      AND m.created_at = n.created_at
  );
