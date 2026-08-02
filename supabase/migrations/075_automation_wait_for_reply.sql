-- ============================================================
-- 075_automation_wait_for_reply.sql — pause a sequence on the customer
--
-- The automation engine could only ever wait for a CLOCK. `wait` parks a
-- run in automation_pending_executions with a `run_at`, and the cron
-- resumes it when that time passes. There was no way to park a run until
-- the customer does something, which is what a drip campaign needs the
-- moment it asks a question:
--
--     send "Still interested?"  →  wait for the reply  →  branch
--
-- Without it, a Condition placed under a Send Buttons step evaluates
-- milliseconds later, against the message that TRIGGERED the automation
-- (usually none at all), so it always takes the same branch. The engine
-- had the suspend/resume machinery already — it just had one wake-up
-- source. This adds a second.
--
-- Three outcomes, not two
--   A question has a third answer: silence. Most contacts never tap
--   anything, so 'timeout' joins 'yes'/'no' as a real branch rather than
--   being folded into 'no' — "said no" and "never answered" usually
--   deserve different follow-ups, and conflating them is how a drip ends
--   up thanking someone for a reply they never sent.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ---- (1) how a parked run wakes up ------------------------
-- 'timer' is the historical behaviour and stays the default, so every
-- existing pending row keeps resuming exactly as before.
ALTER TABLE automation_pending_executions
  ADD COLUMN IF NOT EXISTS wait_kind TEXT NOT NULL DEFAULT 'timer';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'automation_pending_wait_kind_check'
  ) THEN
    ALTER TABLE automation_pending_executions
      ADD CONSTRAINT automation_pending_wait_kind_check
      CHECK (wait_kind IN ('timer', 'reply'));
  END IF;
END $$;

-- The wait_for_reply step itself. Its children (the yes/no/timeout
-- branches) hang off this id, exactly as a Condition's children do —
-- on resume the engine descends into it rather than continuing at
-- next_step_position.
ALTER TABLE automation_pending_executions
  ADD COLUMN IF NOT EXISTS reply_step_id UUID
    REFERENCES automation_steps(id) ON DELETE CASCADE;

-- ---- (2) widen `branch` to admit 'timeout' -----------------
-- Both tables carry the same vocabulary and both must accept it: the
-- steps table stores which branch a child belongs to, the pending table
-- stores which branch a parked run will resume into.
ALTER TABLE automation_steps
  DROP CONSTRAINT IF EXISTS automation_steps_branch_check;
ALTER TABLE automation_steps
  ADD CONSTRAINT automation_steps_branch_check
  CHECK (branch IN ('yes', 'no', 'timeout'));

ALTER TABLE automation_pending_executions
  DROP CONSTRAINT IF EXISTS automation_pending_executions_branch_check;
ALTER TABLE automation_pending_executions
  ADD CONSTRAINT automation_pending_executions_branch_check
  CHECK (branch IN ('yes', 'no', 'timeout'));

-- ---- (3) the lookup the webhook does on every inbound message ----
-- Partial: only rows actually awaiting a reply are ever probed, and
-- they're a tiny slice of the table. Without this the hot path degrades
-- into a scan of every pending execution on each message received.
CREATE INDEX IF NOT EXISTS idx_automation_pending_awaiting_reply
  ON automation_pending_executions (contact_id, status)
  WHERE wait_kind = 'reply' AND status = 'pending';

COMMENT ON COLUMN automation_pending_executions.wait_kind IS
  '''timer'' = resume when run_at passes (the `wait` step). ''reply'' = resume when the contact sends a message; run_at then acts as the give-up deadline that routes to the ''timeout'' branch.';
COMMENT ON COLUMN automation_pending_executions.reply_step_id IS
  'The wait_for_reply step whose branch children the run resumes into. NULL for timer waits, which resume at next_step_position instead.';
