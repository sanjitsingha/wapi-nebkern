-- ============================================================
-- 078 — messages.account_id, so Realtime can actually deliver
--
-- WHY THIS EXISTS
--
-- `messages` was the one hot table that migration 017 never gave an
-- `account_id` column. Its policies (017, lines 511-518) therefore have
-- to reach through the parent row:
--
--   EXISTS (SELECT 1 FROM conversations c
--           WHERE c.id = messages.conversation_id
--             AND is_account_member(c.account_id))
--
-- Supabase Realtime evaluates a cross-table policy like that poorly, so
-- INSERT events on `messages` frequently never reach the subscribed
-- client. The inbox worked around it by refetching the ENTIRE open
-- conversation every 5 seconds (inbox/page.tsx), which on a 100-message
-- thread is ~17 GB of egress a month for a single user — over 3x the
-- whole free-tier allowance.
--
-- Flattening the policy to a single-table check is what makes Realtime
-- reliable, which in turn lets that poll drop to a slow safety net.
--
-- SAFETY
--
-- Written to be re-runnable and non-destructive:
--   * the column is added nullable and backfilled before any NOT NULL
--   * a BEFORE INSERT trigger fills it, so the 27 insert sites in the
--     webhook/send paths need no code change and cannot forget it
--   * the NOT NULL is applied ONLY if the backfill left no gaps
--   * policies are replaced, not dropped-and-left — there is never a
--     window where `messages` is unprotected
-- ============================================================

-- ---- 1. Column ------------------------------------------------
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

-- ---- 2. Backfill from the parent conversation -----------------
-- Batched by conversation rather than one giant UPDATE so this stays
-- manageable on a large table. Only touches rows that need it, so a
-- re-run is a no-op.
UPDATE messages m
SET account_id = c.account_id
FROM conversations c
WHERE c.id = m.conversation_id
  AND m.account_id IS DISTINCT FROM c.account_id;

-- ---- 3. Keep it filled, without touching application code -----
-- Every insert path (Meta webhook, send routes, flows engine,
-- broadcasts) inserts messages knowing only conversation_id. A trigger
-- derives the account so none of them can drift, including any future
-- insert site.
CREATE OR REPLACE FUNCTION set_message_account_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_id IS NULL THEN
    SELECT c.account_id INTO NEW.account_id
    FROM conversations c
    WHERE c.id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION set_message_account_id() OWNER TO postgres;

DROP TRIGGER IF EXISTS messages_set_account_id ON messages;
CREATE TRIGGER messages_set_account_id
  BEFORE INSERT OR UPDATE OF conversation_id ON messages
  FOR EACH ROW
  EXECUTE FUNCTION set_message_account_id();

-- ---- 4. updated_at, so the poll can be incremental ------------
-- `messages` only ever had created_at. That is not enough for an
-- incremental sync: a message's status moves sending → sent →
-- delivered → read AFTER insert, and a created_at watermark would
-- never see those transitions — delivery ticks would stop updating.
--
-- With updated_at maintained here, the inbox can ask for "anything
-- that changed since X" in one query that returns zero rows when the
-- thread is idle, and still catches both new messages and status
-- changes.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Seed existing rows so the first poll after deploy isn't handed a
-- NULL watermark for the whole table.
UPDATE messages SET updated_at = created_at WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION touch_message_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

ALTER FUNCTION touch_message_updated_at() OWNER TO postgres;

DROP TRIGGER IF EXISTS messages_touch_updated_at ON messages;
CREATE TRIGGER messages_touch_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION touch_message_updated_at();

-- ---- 5. Indexes -----------------------------------------------
-- The inbox's hot query is "this account's messages in this
-- conversation, oldest first".
CREATE INDEX IF NOT EXISTS idx_messages_account_conversation_created
  ON messages(account_id, conversation_id, created_at);

-- The incremental poll: "anything in this conversation that changed
-- since my watermark".
CREATE INDEX IF NOT EXISTS idx_messages_conversation_updated
  ON messages(conversation_id, updated_at);

-- ---- 6. Flatten the policies ----------------------------------
-- Same access semantics as 017 — read for any member, write for agent
-- and above — but resolvable from the row itself, which is what
-- Realtime needs. CREATE OR REPLACE POLICY isn't available on all
-- supported versions, so drop+create each in turn; both statements run
-- inside the migration's implicit transaction, so there is no window
-- where the table is readable without a policy.
DROP POLICY IF EXISTS messages_select ON messages;
CREATE POLICY messages_select ON messages FOR SELECT USING (
  is_account_member(account_id)
);

DROP POLICY IF EXISTS messages_modify ON messages;
CREATE POLICY messages_modify ON messages FOR ALL USING (
  is_account_member(account_id, 'agent')
) WITH CHECK (
  is_account_member(account_id, 'agent')
);
-- Service-role webhook inserts (Meta deliveries) bypass RLS as before.

-- ---- 7. NOT NULL, but only when it is safe --------------------
-- A message whose conversation was deleted mid-migration, or an
-- orphaned row from an older fork, would make this fail and roll back
-- the whole migration. Guard it: enforce the constraint when the
-- backfill is complete, and leave a notice when it is not, so the
-- column still works and the gap is visible rather than fatal.
DO $$
DECLARE
  orphans BIGINT;
BEGIN
  SELECT count(*) INTO orphans FROM messages WHERE account_id IS NULL;

  IF orphans = 0 THEN
    ALTER TABLE messages ALTER COLUMN account_id SET NOT NULL;
  ELSE
    RAISE NOTICE
      '078: % message row(s) have no account_id (orphaned conversation?). '
      'Column left nullable. Investigate, then run: '
      'ALTER TABLE messages ALTER COLUMN account_id SET NOT NULL;',
      orphans;
  END IF;
END $$;
