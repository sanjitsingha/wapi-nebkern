-- ============================================================
-- 102_campaign_messages_in_chat
--
-- A campaign went to Meta and into broadcast_recipients, and nowhere
-- else. When the contact replied, the webhook opened a chat that began
-- with their reply — the message they were replying to was not in it,
-- so whoever picked the chat up was answering blind.
--
-- Now a sent campaign message is part of the contact's chat:
--
--   1. broadcast_recipients.rendered_body keeps the text each recipient
--      actually got, variables filled. The send paths write it after the
--      send succeeds — it is the one thing a chat message needs that the
--      recipient row did not already hold.
--   2. When it is written and the contact already has a WhatsApp chat,
--      the message is appended to that chat straight away.
--   3. When a WhatsApp chat is created for a contact — their reply, an
--      agent starting one, the API, an automation — every earlier
--      campaign message to them is copied in, so it opens with history.
--
-- A campaign does NOT create a chat by itself. A 5,000-contact send
-- would otherwise drop 5,000 conversations into the inbox for people who
-- may never answer; the chat appears when there is something to handle,
-- and brings the campaign with it.
--
-- Triggers rather than app code because chats are created from many
-- places, and every one of them would have to remember the backfill.
-- Both are best-effort: a failure is raised as a WARNING and never
-- blocks the send or the inbound message that created the chat.
--
-- Failed sends are left out — there is nothing the contact received —
-- and so are campaigns sent before this migration, whose variable values
-- were never recorded anywhere.
-- ============================================================

ALTER TABLE broadcast_recipients
  ADD COLUMN IF NOT EXISTS rendered_body TEXT;

-- One contact's campaign history, for the backfill.
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_contact_chat
  ON broadcast_recipients (contact_id)
  WHERE whatsapp_message_id IS NOT NULL AND rendered_body IS NOT NULL;

-- broadcast_recipients.status has 'pending' and 'replied';
-- messages.status has neither.
CREATE OR REPLACE FUNCTION public.campaign_message_status(recipient_status TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE recipient_status
    WHEN 'delivered' THEN 'delivered'
    WHEN 'read'      THEN 'read'
    WHEN 'replied'   THEN 'read'
    ELSE 'sent'
  END;
$$;

-- ── 2. Append to a chat that already exists ─────────────────────────
CREATE OR REPLACE FUNCTION public.campaign_recipient_to_chat()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id      UUID;
  v_sender_id       UUID;
  v_template        TEXT;
  v_conversation_id UUID;
  v_sent_at         TIMESTAMPTZ;
BEGIN
  IF NEW.rendered_body IS NULL
     OR NEW.whatsapp_message_id IS NULL
     OR NEW.contact_id IS NULL
     OR NEW.status = 'failed'
     OR (OLD.rendered_body IS NOT DISTINCT FROM NEW.rendered_body
         AND OLD.whatsapp_message_id IS NOT DISTINCT FROM NEW.whatsapp_message_id)
  THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT b.account_id, b.user_id, b.template_name
      INTO v_account_id, v_sender_id, v_template
      FROM broadcasts b
     WHERE b.id = NEW.broadcast_id;

    SELECT c.id
      INTO v_conversation_id
      FROM conversations c
     WHERE c.account_id = v_account_id
       AND c.contact_id = NEW.contact_id
       AND c.channel = 'whatsapp'
     ORDER BY c.created_at
     LIMIT 1;

    -- No chat yet. Nothing to do now — section 3 copies this in when
    -- one is created.
    IF v_conversation_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Already there: a repeated write, or the backfill got to it first.
    IF EXISTS (
      SELECT 1 FROM messages m
       WHERE m.conversation_id = v_conversation_id
         AND m.message_id = NEW.whatsapp_message_id
    ) THEN
      RETURN NEW;
    END IF;

    v_sent_at := COALESCE(NEW.sent_at, NEW.created_at, NOW());

    INSERT INTO messages (
      conversation_id, sender_type, sender_id, content_type, content_text,
      template_name, message_id, status, created_at
    ) VALUES (
      v_conversation_id, 'agent', v_sender_id, 'template', NEW.rendered_body,
      v_template, NEW.whatsapp_message_id,
      campaign_message_status(NEW.status), v_sent_at
    );

    -- Move the inbox preview forward only. A late write must not replace
    -- a newer message the customer or an agent has sent since.
    UPDATE conversations
       SET last_message_text = NEW.rendered_body,
           last_message_at   = v_sent_at,
           updated_at        = NOW()
     WHERE id = v_conversation_id
       AND (last_message_at IS NULL OR last_message_at <= v_sent_at);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'campaign_recipient_to_chat(%): %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS broadcast_recipients_to_chat ON broadcast_recipients;
CREATE TRIGGER broadcast_recipients_to_chat
AFTER UPDATE OF rendered_body, whatsapp_message_id ON broadcast_recipients
FOR EACH ROW EXECUTE FUNCTION public.campaign_recipient_to_chat();

-- ── 3. Copy campaign history into a new chat ────────────────────────
CREATE OR REPLACE FUNCTION public.backfill_campaign_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last RECORD;
BEGIN
  IF NEW.channel <> 'whatsapp'
     OR NEW.account_id IS NULL
     OR NEW.contact_id IS NULL
  THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO messages (
      conversation_id, sender_type, sender_id, content_type, content_text,
      template_name, message_id, status, created_at
    )
    SELECT NEW.id, 'agent', b.user_id, 'template', r.rendered_body,
           b.template_name, r.whatsapp_message_id,
           campaign_message_status(r.status),
           COALESCE(r.sent_at, r.created_at)
      FROM broadcast_recipients r
      JOIN broadcasts b ON b.id = r.broadcast_id
     WHERE b.account_id = NEW.account_id
       AND r.contact_id = NEW.contact_id
       AND r.whatsapp_message_id IS NOT NULL
       AND r.rendered_body IS NOT NULL
       AND r.status <> 'failed'
       AND NOT EXISTS (
         SELECT 1 FROM messages m
          WHERE m.conversation_id = NEW.id
            AND m.message_id = r.whatsapp_message_id
       );

    -- Give the chat a preview when whoever created it set none. Their own
    -- first message, written next, moves it on as it always did.
    IF NEW.last_message_at IS NULL THEN
      SELECT r.rendered_body AS body,
             COALESCE(r.sent_at, r.created_at) AS sent_at
        INTO v_last
        FROM broadcast_recipients r
        JOIN broadcasts b ON b.id = r.broadcast_id
       WHERE b.account_id = NEW.account_id
         AND r.contact_id = NEW.contact_id
         AND r.whatsapp_message_id IS NOT NULL
         AND r.rendered_body IS NOT NULL
         AND r.status <> 'failed'
       ORDER BY COALESCE(r.sent_at, r.created_at) DESC
       LIMIT 1;

      IF FOUND THEN
        UPDATE conversations
           SET last_message_text = v_last.body,
               last_message_at   = v_last.sent_at
         WHERE id = NEW.id
           AND last_message_at IS NULL;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'backfill_campaign_messages(%): %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conversations_backfill_campaigns ON conversations;
CREATE TRIGGER conversations_backfill_campaigns
AFTER INSERT ON conversations
FOR EACH ROW EXECUTE FUNCTION public.backfill_campaign_messages();
