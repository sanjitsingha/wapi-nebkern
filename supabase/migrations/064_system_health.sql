-- ============================================================
-- 064_system_health.sql — admin System Health console plumbing
--
-- Two things:
--   1. system_cron_heartbeats — one row per background job; each cron
--      run upserts its liveness (last run, status, duration, detail,
--      rolling counters) via record_cron_heartbeat(). Lets the admin
--      console tell a healthy cron from a silently-dead one.
--   2. A set of SECURITY DEFINER metric functions that expose
--      Postgres/storage/auth internals (database size, table sizes,
--      per-bucket storage usage, auth user stats) as jsonb. These read
--      pg_catalog / storage / auth, which normal roles can't — so they
--      run as the definer and are LOCKED to the service role (REVOKE
--      from public, GRANT to service_role). Only the admin back office
--      (service-role client) can call them; a tenant cannot.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ---- (1) cron heartbeats -----------------------------------
CREATE TABLE IF NOT EXISTS system_cron_heartbeats (
  job_key          text PRIMARY KEY,
  last_run_at      timestamptz NOT NULL DEFAULT now(),
  last_status      text NOT NULL DEFAULT 'ok'
                     CHECK (last_status IN ('ok', 'error')),
  last_duration_ms integer,
  last_detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error       text,
  run_count        bigint NOT NULL DEFAULT 0,
  error_count      bigint NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- RLS on with NO policies ⇒ tenants can't read it; the service-role
-- admin client bypasses RLS.
ALTER TABLE system_cron_heartbeats ENABLE ROW LEVEL SECURITY;

-- Atomic upsert of a job's heartbeat, incrementing the rolling counters.
CREATE OR REPLACE FUNCTION public.record_cron_heartbeat(
  p_job_key     text,
  p_status      text,
  p_duration_ms integer,
  p_detail      jsonb,
  p_error       text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO system_cron_heartbeats AS h (
    job_key, last_run_at, last_status, last_duration_ms, last_detail,
    last_error, run_count, error_count, updated_at
  )
  VALUES (
    p_job_key, now(),
    CASE WHEN p_status = 'error' THEN 'error' ELSE 'ok' END,
    p_duration_ms, coalesce(p_detail, '{}'::jsonb), p_error,
    1, CASE WHEN p_status = 'error' THEN 1 ELSE 0 END, now()
  )
  ON CONFLICT (job_key) DO UPDATE SET
    last_run_at      = now(),
    last_status      = excluded.last_status,
    last_duration_ms = excluded.last_duration_ms,
    last_detail      = excluded.last_detail,
    last_error       = excluded.last_error,
    run_count        = h.run_count + 1,
    error_count      = h.error_count
                         + CASE WHEN p_status = 'error' THEN 1 ELSE 0 END,
    updated_at       = now();
$$;

REVOKE ALL ON FUNCTION public.record_cron_heartbeat(text, text, integer, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_cron_heartbeat(text, text, integer, jsonb, text) TO service_role;

-- ---- (2) metric functions (service-role only) --------------

-- Database: size, connection load, version.
CREATE OR REPLACE FUNCTION public.admin_database_metrics()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT jsonb_build_object(
    'size_bytes', pg_database_size(current_database()),
    'active_connections',
      (SELECT count(*) FROM pg_stat_activity
        WHERE datname = current_database()),
    'max_connections', current_setting('max_connections')::int,
    'postgres_version', current_setting('server_version')
  );
$$;

REVOKE ALL ON FUNCTION public.admin_database_metrics() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_database_metrics() TO service_role;

-- Largest public tables by total (heap+indexes+toast) size, with the
-- planner's row estimate (cheap; exact counts would scan every table).
CREATE OR REPLACE FUNCTION public.admin_table_metrics()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'name', c.relname,
      'bytes', pg_total_relation_size(c.oid),
      'est_rows', GREATEST(c.reltuples, 0)::bigint
    ) AS t
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC
    LIMIT 12
  ) sub;
$$;

REVOKE ALL ON FUNCTION public.admin_table_metrics() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_table_metrics() TO service_role;

-- Storage usage per bucket (object count + summed byte size).
CREATE OR REPLACE FUNCTION public.admin_storage_metrics()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT coalesce(jsonb_agg(b ORDER BY (b->>'bytes')::bigint DESC), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'bucket', o.bucket_id,
      'objects', count(*),
      'bytes', coalesce(sum((o.metadata->>'size')::bigint), 0)
    ) AS b
    FROM storage.objects o
    GROUP BY o.bucket_id
  ) s;
$$;

REVOKE ALL ON FUNCTION public.admin_storage_metrics() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_storage_metrics() TO service_role;

-- Auth: user totals, confirmation, recency.
CREATE OR REPLACE FUNCTION public.admin_auth_metrics()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT jsonb_build_object(
    'total', count(*),
    'confirmed', count(*) FILTER (WHERE email_confirmed_at IS NOT NULL),
    'unconfirmed', count(*) FILTER (WHERE email_confirmed_at IS NULL),
    'new_24h', count(*) FILTER (WHERE created_at > now() - interval '24 hours'),
    'new_7d', count(*) FILTER (WHERE created_at > now() - interval '7 days'),
    'active_24h', count(*) FILTER (WHERE last_sign_in_at > now() - interval '24 hours')
  )
  FROM auth.users;
$$;

REVOKE ALL ON FUNCTION public.admin_auth_metrics() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_auth_metrics() TO service_role;
