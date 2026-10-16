-- ============================================================
-- 114: Maya's reply settings (Maya → Configuration)
--
--   activation_prompt       Activation rules: an optional prompt that
--                           decides, message by message, whether Maya
--                           should answer at all, checked with one short
--                           yes/no model call (src/lib/ai/activation.ts).
--                           NULL = no rules, answer every message.
--   response_delay_seconds  How long she waits after the customer's last
--                           message before replying, so a teammate can
--                           answer first. 8 is the fixed quiet period she
--                           used before this was a setting.
--   snooze_seconds          How long she stays quiet after a teammate
--                           replies. 0 = no pause.
--   operating_hours         {enabled, timezone, days:{mon..sun: {start,
--                           end} | null}}; outside the hours she doesn't
--                           auto-reply. NULL = always.
--
-- Every default keeps an existing account behaving exactly as before.
-- Waits longer than the reply engine holds in memory are finished by the
-- minute cron, which finds them by their debounce deadline — hence the
-- partial index.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS activation_prompt text,
  ADD COLUMN IF NOT EXISTS response_delay_seconds integer NOT NULL DEFAULT 8
    CHECK (response_delay_seconds BETWEEN 3 AND 6000),
  ADD COLUMN IF NOT EXISTS snooze_seconds integer NOT NULL DEFAULT 0
    CHECK (snooze_seconds BETWEEN 0 AND 6000),
  ADD COLUMN IF NOT EXISTS operating_hours jsonb;

CREATE INDEX IF NOT EXISTS idx_conversations_ai_debounce_deadline
  ON conversations (ai_debounce_deadline)
  WHERE ai_debounce_deadline IS NOT NULL;
