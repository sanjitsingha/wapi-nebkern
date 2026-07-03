-- Track when the customer last sent a message so the inbox can show
-- the remaining WhatsApp 24-hour messaging window.
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS customer_replied_at TIMESTAMPTZ;

-- Backfill from existing messages so the timer works on launch.
UPDATE conversations c
SET customer_replied_at = (
  SELECT MAX(m.created_at)
  FROM messages m
  WHERE m.conversation_id = c.id
    AND m.sender_type = 'customer'
)
WHERE customer_replied_at IS NULL;
