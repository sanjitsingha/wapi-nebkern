-- ============================================================
-- 067_walkthrough.sql — per-user product walkthrough state
--
-- Tracks whether a user has finished (or dismissed) the guided
-- walkthrough, so it auto-runs exactly once per person and the sidebar
-- "Walkthrough" button can replay it on demand.
--
-- Design notes:
--   - Lives on `profiles`, not `accounts`: the tour teaches a person
--     how to use the app, so every team member gets their own run. An
--     account-level flag would mean the second member to join never
--     sees it.
--   - Timestamp rather than boolean — "when did they finish" is
--     strictly more information than "did they", and it lets us
--     re-trigger the tour after a major UI change by comparing against
--     a cutoff date instead of resetting a flag.
--   - NULL means "never completed" → the tour auto-starts. Backfilled
--     to now() for existing users so nobody who has already learned
--     the app gets an unsolicited tour on next login.
--   - No new RLS policy needed: `profiles_update` already scopes
--     writes to `auth.uid() = user_id`, which is exactly the
--     permission a user needs to record their own progress.
-- ============================================================

alter table public.profiles
  add column if not exists walkthrough_completed_at timestamptz;

comment on column public.profiles.walkthrough_completed_at is
  'When this user finished or dismissed the guided walkthrough. NULL = never seen, so the tour auto-starts on next dashboard load.';

-- Existing users have already found their way around — treat them as
-- done so the tour only ever surfaces for genuinely new sign-ups.
update public.profiles
   set walkthrough_completed_at = now()
 where walkthrough_completed_at is null;
