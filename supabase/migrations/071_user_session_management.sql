-- ============================================================
-- 071_user_session_management.sql — self-serve device/session list
--
-- Lets a signed-in user SEE their own active auth sessions (one per
-- device/browser) and revoke any of them from Settings → Profile.
--
-- auth.sessions isn't reachable from the client (protected schema, no
-- RLS), so two SECURITY DEFINER functions in `public` expose exactly the
-- caller's own rows: every statement is filtered by auth.uid(), so a user
-- can never see or revoke another user's session. Both are locked down to
-- the `authenticated` role only.
--
-- Revoking = deleting the session row, which kills its refresh token; the
-- device loses access as soon as its short-lived access token expires.
--
-- Idempotent: CREATE OR REPLACE, and the grants are reset on every run.
-- ============================================================

-- ---- list the caller's own sessions ------------------------
create or replace function public.list_user_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  refreshed_at timestamptz,
  not_after timestamptz,
  user_agent text,
  ip text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    s.id,
    s.created_at,
    s.updated_at,
    -- refreshed_at is a naive UTC timestamp; stamp the zone so the client
    -- gets an unambiguous instant to format as "last active".
    (s.refreshed_at at time zone 'utc') as refreshed_at,
    s.not_after,
    s.user_agent,
    host(s.ip) as ip
  from auth.sessions s
  where s.user_id = (select auth.uid())
  order by coalesce((s.refreshed_at at time zone 'utc'), s.updated_at, s.created_at) desc
$$;

revoke all on function public.list_user_sessions() from public, anon;
grant execute on function public.list_user_sessions() to authenticated;

-- ---- revoke one of the caller's sessions -------------------
create or replace function public.revoke_user_session(target uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed int;
begin
  delete from auth.sessions
  where id = target
    and user_id = (select auth.uid());
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

revoke all on function public.revoke_user_session(uuid) from public, anon;
grant execute on function public.revoke_user_session(uuid) to authenticated;
