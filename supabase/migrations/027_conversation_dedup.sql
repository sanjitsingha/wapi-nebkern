-- ============================================================
-- 027_conversation_dedup
--
-- Guarantee ONE conversation per (account, contact).
--
-- The WhatsApp webhook assumes a single conversation thread per
-- contact, but nothing in the database enforced it. A race between two
-- near-simultaneous inbound messages (each looking up "no conversation
-- yet" and both inserting) could create a duplicate pair; once two
-- existed, the webhook's old `.single()` lookup raised PGRST116 on every
-- later message and created yet another — a runaway that surfaced as
-- "every message starts a new chat with the same number".
--
-- The handler is now tolerant (reuses the oldest thread), but that only
-- stops growth. This migration, in order, mirrors 022_contact_phone_dedup:
--   1. merges existing duplicate conversations into the oldest row,
--      re-pointing all child records first so nothing is lost;
--   2. refreshes the surviving thread's denormalized last-message fields;
--   3. adds a UNIQUE index on (account_id, contact_id) so the race can
--      never recreate a duplicate.
--
-- No data loss — messages, reactions, deals, and flow runs on a losing
-- conversation are re-pointed to the survivor before it is deleted
-- (messages + message_reactions are ON DELETE CASCADE, so the re-point
-- is what saves them).
--
-- Idempotent — safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.merge_duplicate_conversations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group    RECORD;
  v_survivor UUID;
  v_losers   UUID[];
  v_merged   INTEGER := 0;
BEGIN
  FOR v_group IN
    SELECT account_id,
           contact_id,
           array_agg(id ORDER BY created_at ASC, id ASC) AS ids
    FROM conversations
    GROUP BY account_id, contact_id
    HAVING count(*) > 1
  LOOP
    v_survivor := v_group.ids[1];
    v_losers   := v_group.ids[2:array_length(v_group.ids, 1)];

    -- Re-point children to the survivor BEFORE deleting the losers.
    -- messages + message_reactions are ON DELETE CASCADE (without this
    -- re-point they'd be destroyed); deals has no cascade (a delete
    -- would fail its FK); flow_runs is ON DELETE SET NULL. None of these
    -- have a conversation-scoped unique constraint, so a plain re-point
    -- is safe.
    UPDATE messages          SET conversation_id = v_survivor WHERE conversation_id = ANY(v_losers);
    UPDATE message_reactions SET conversation_id = v_survivor WHERE conversation_id = ANY(v_losers);
    UPDATE deals             SET conversation_id = v_survivor WHERE conversation_id = ANY(v_losers);
    UPDATE flow_runs         SET conversation_id = v_survivor WHERE conversation_id = ANY(v_losers);

    DELETE FROM conversations WHERE id = ANY(v_losers);

    v_merged := v_merged + COALESCE(array_length(v_losers, 1), 0);
  END LOOP;

  -- Refresh denormalized last-message fields on every thread that has
  -- messages, so a merged survivor's inbox row reflects the combined
  -- history rather than a stale value from before the merge.
  UPDATE conversations c SET
    last_message_at   = m.max_created,
    last_message_text = m.last_text,
    updated_at        = NOW()
  FROM (
    SELECT DISTINCT ON (conversation_id)
           conversation_id,
           created_at AS max_created,
           COALESCE(content_text, '[' || content_type || ']') AS last_text
    FROM messages
    ORDER BY conversation_id, created_at DESC
  ) m
  WHERE m.conversation_id = c.id;

  RETURN v_merged;
END;
$$;

ALTER FUNCTION public.merge_duplicate_conversations() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.merge_duplicate_conversations() FROM PUBLIC;

-- Collapse whatever duplicates exist right now.
SELECT public.merge_duplicate_conversations();

-- Authoritative guarantee: one conversation per (account, contact).
-- Partial (account_id IS NOT NULL) because legacy rows predate the
-- account_id column added in 017; the merge above already collapsed
-- any NULL-account duplicates by grouping NULLs together.
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_account_contact
  ON conversations (account_id, contact_id)
  WHERE account_id IS NOT NULL;
