-- ============================================================
-- 096 — Message Error Message
--
-- Store detailed error information (error code, title, and details)
-- from Meta Cloud API or outbound send failures on the messages table
-- so agents and team members can inspect why a message failed.
-- ============================================================

ALTER TABLE messages ADD COLUMN IF NOT EXISTS error_message TEXT;

COMMENT ON COLUMN messages.error_message IS 'Error description or Meta Cloud API error reason when status = failed';
