-- ============================================================
-- 048_append_automation_log_steps.sql — atomic step-result append
--
-- engine.ts's appendResults() used to SELECT steps_executed, merge in
-- JS, then UPDATE — two round trips per automation-log write, on the
-- hot path of every single automation run (webhook -> automations ->
-- Meta send -> this write, all inline before the webhook can ack).
-- This function does the JSONB concat + status/error_message update
-- in one statement, cutting that to one round trip and making
-- concurrent scope-completions (nested condition branches) race-safe
-- instead of last-write-wins.
--
-- p_status/p_error_message NULL = leave the existing column value
-- alone (mirrors the old code's `if (status !== null)` /
-- `if (errorMessage)` guards — status is only overwritten by the
-- outermost scope, and error_message is never explicitly cleared).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE OR REPLACE FUNCTION public.append_automation_log_steps(
  p_log_id UUID,
  p_new_items JSONB,
  p_status TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE automation_logs
  SET steps_executed = steps_executed || p_new_items,
      status = COALESCE(p_status, status),
      error_message = COALESCE(p_error_message, error_message)
  WHERE id = p_log_id;
$$;

ALTER FUNCTION public.append_automation_log_steps(UUID, JSONB, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.append_automation_log_steps(UUID, JSONB, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_automation_log_steps(UUID, JSONB, TEXT, TEXT) TO authenticated, service_role;
