-- ============================================================
-- 084_admin_usage_metrics.sql — Supabase Usage & Quotas monitor metrics
--
-- Exposes a 14-day daily user signup trend series for charting.
-- Runs as SECURITY DEFINER locked to the service role.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_auth_signup_trend()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT coalesce(jsonb_agg(d ORDER BY d->>'day' ASC), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'day', to_char(date_trunc('day', series), 'YYYY-MM-DD'),
      'label', to_char(date_trunc('day', series), 'Mon DD'),
      'signups', coalesce(count(u.id), 0)::int
    ) AS d
    FROM generate_series(
      date_trunc('day', now() - interval '13 days'),
      date_trunc('day', now()),
      interval '1 day'
    ) series
    LEFT JOIN auth.users u
      ON date_trunc('day', u.created_at) = series
    GROUP BY series
  ) sub;
$$;

REVOKE ALL ON FUNCTION public.admin_auth_signup_trend() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_auth_signup_trend() TO service_role;
