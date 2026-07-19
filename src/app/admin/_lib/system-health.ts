// ============================================================
// System Health collector — the single source the admin console renders.
//
// Runs under the service-role adminDb() client, so it can call the
// SECURITY-DEFINER metric functions (migration 064) and read the
// webhook + heartbeat tables cross-tenant. Everything is defensive:
// each section is isolated so one failing probe degrades only its own
// card, never the whole page.
// ============================================================

import 'server-only';

import { adminDb } from './admin-db';
import { KNOWN_CRONS, type CronJobKey } from '@/lib/system/cron-heartbeat';

export type ServiceStatus = 'operational' | 'degraded' | 'down' | 'unknown';

// Cross-region round trips (app → Supabase) are commonly a few hundred ms,
// so only flag the DB slow when it's clearly beyond that.
const DB_DEGRADED_MS = 700;
const WEBHOOK_BACKLOG_DEGRADED_MS = 10 * 60 * 1000; // 10 min stuck ⇒ degraded
const WEBHOOK_FAIL_RATE_DEGRADED = 0.2; // >20% failures in 24h ⇒ degraded

export interface DatabaseHealth {
  status: ServiceStatus;
  latencyMs: number | null;
  sizeBytes: number | null;
  activeConnections: number | null;
  maxConnections: number | null;
  postgresVersion: string | null;
  error?: string;
}

export interface StorageBucketUsage {
  bucket: string;
  objects: number;
  bytes: number;
}

export interface StorageHealth {
  status: ServiceStatus;
  totalBytes: number;
  totalObjects: number;
  buckets: StorageBucketUsage[];
  error?: string;
}

export interface AuthHealth {
  status: ServiceStatus;
  total: number;
  confirmed: number;
  unconfirmed: number;
  new24h: number;
  new7d: number;
  active24h: number;
  error?: string;
}

export interface RuntimeHealth {
  status: ServiceStatus;
  uptimeSeconds: number;
  nodeVersion: string;
  environment: string;
  healthEndpoint: string;
}

export interface TableUsage {
  name: string;
  bytes: number;
  estRows: number;
}

export interface WebhookHealth {
  status: ServiceStatus;
  activeEndpoints: number;
  pending: number;
  oldestPendingAgeMs: number | null;
  delivered24h: number;
  failed24h: number;
  successRate24h: number | null;
  error?: string;
}

export interface CronHealth {
  key: CronJobKey;
  label: string;
  description: string;
  intervalSeconds: number;
  status: ServiceStatus;
  lastRunAt: string | null;
  ageMs: number | null;
  lastStatus: 'ok' | 'error' | null;
  lastDurationMs: number | null;
  runCount: number;
  errorCount: number;
  lastError: string | null;
  detail: Record<string, unknown>;
}

export interface ConfigItem {
  key: string;
  label: string;
  group: string;
  present: boolean;
}

export interface SystemHealth {
  generatedAt: string;
  overall: ServiceStatus;
  database: DatabaseHealth;
  storage: StorageHealth;
  auth: AuthHealth;
  runtime: RuntimeHealth;
  tables: TableUsage[];
  webhooks: WebhookHealth;
  crons: CronHealth[];
  config: ConfigItem[];
}

const RANK: Record<ServiceStatus, number> = {
  operational: 0,
  unknown: 1,
  degraded: 2,
  down: 3,
};

/** Worst (most severe) status wins; 'unknown' never outranks a real one. */
function worst(...statuses: ServiceStatus[]): ServiceStatus {
  let result: ServiceStatus = 'operational';
  for (const s of statuses) {
    if (s === 'unknown') continue;
    if (RANK[s] > RANK[result]) result = s;
  }
  return result;
}

function toNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

async function collectDatabase(): Promise<DatabaseHealth> {
  const db = adminDb();
  const t0 = Date.now();
  try {
    const { data, error } = await db.rpc('admin_database_metrics');
    const latencyMs = Date.now() - t0;
    if (error) {
      return {
        status: 'down',
        latencyMs,
        sizeBytes: null,
        activeConnections: null,
        maxConnections: null,
        postgresVersion: null,
        error: error.message,
      };
    }
    const m = (data ?? {}) as Record<string, unknown>;
    return {
      status: latencyMs > DB_DEGRADED_MS ? 'degraded' : 'operational',
      latencyMs,
      sizeBytes: toNum(m.size_bytes),
      activeConnections: toNum(m.active_connections),
      maxConnections: toNum(m.max_connections),
      postgresVersion:
        typeof m.postgres_version === 'string' ? m.postgres_version : null,
    };
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Date.now() - t0,
      sizeBytes: null,
      activeConnections: null,
      maxConnections: null,
      postgresVersion: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function collectStorage(): Promise<StorageHealth> {
  const db = adminDb();
  try {
    const { data, error } = await db.rpc('admin_storage_metrics');
    if (error) throw new Error(error.message);
    const buckets = (Array.isArray(data) ? data : []) as StorageBucketUsage[];
    const totalBytes = buckets.reduce((n, b) => n + (b.bytes ?? 0), 0);
    const totalObjects = buckets.reduce((n, b) => n + (b.objects ?? 0), 0);
    return { status: 'operational', totalBytes, totalObjects, buckets };
  } catch (err) {
    return {
      status: 'down',
      totalBytes: 0,
      totalObjects: 0,
      buckets: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function collectAuth(): Promise<AuthHealth> {
  const db = adminDb();
  try {
    const { data, error } = await db.rpc('admin_auth_metrics');
    if (error) throw new Error(error.message);
    const m = (data ?? {}) as Record<string, unknown>;
    return {
      status: 'operational',
      total: toNum(m.total) ?? 0,
      confirmed: toNum(m.confirmed) ?? 0,
      unconfirmed: toNum(m.unconfirmed) ?? 0,
      new24h: toNum(m.new_24h) ?? 0,
      new7d: toNum(m.new_7d) ?? 0,
      active24h: toNum(m.active_24h) ?? 0,
    };
  } catch (err) {
    return {
      status: 'down',
      total: 0,
      confirmed: 0,
      unconfirmed: 0,
      new24h: 0,
      new7d: 0,
      active24h: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function collectTables(): Promise<TableUsage[]> {
  const db = adminDb();
  try {
    const { data, error } = await db.rpc('admin_table_metrics');
    if (error) return [];
    const rows = (Array.isArray(data) ? data : []) as {
      name: string;
      bytes: number;
      est_rows: number;
    }[];
    return rows.map((r) => ({
      name: r.name,
      bytes: r.bytes ?? 0,
      estRows: r.est_rows ?? 0,
    }));
  } catch {
    return [];
  }
}

async function collectWebhooks(): Promise<WebhookHealth> {
  const db = adminDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    const [endpoints, pending, oldest, delivered, failed] = await Promise.all([
      db
        .from('webhook_endpoints')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
      db
        .from('webhook_deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      db
        .from('webhook_deliveries')
        .select('created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      db
        .from('webhook_deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'success')
        .gte('created_at', since),
      db
        .from('webhook_deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', since),
    ]);

    const pendingCount = pending.count ?? 0;
    const delivered24h = delivered.count ?? 0;
    const failed24h = failed.count ?? 0;
    const total24h = delivered24h + failed24h;
    const successRate24h = total24h > 0 ? delivered24h / total24h : null;

    const oldestPendingAgeMs = oldest.data?.created_at
      ? Date.now() - Date.parse(oldest.data.created_at as string)
      : null;

    let status: ServiceStatus = 'operational';
    if (
      oldestPendingAgeMs !== null &&
      oldestPendingAgeMs > WEBHOOK_BACKLOG_DEGRADED_MS
    ) {
      status = 'degraded'; // queue is backing up — dispatcher likely stalled
    }
    if (
      successRate24h !== null &&
      1 - successRate24h > WEBHOOK_FAIL_RATE_DEGRADED
    ) {
      status = 'degraded'; // receivers rejecting a large share
    }

    return {
      status,
      activeEndpoints: endpoints.count ?? 0,
      pending: pendingCount,
      oldestPendingAgeMs,
      delivered24h,
      failed24h,
      successRate24h,
    };
  } catch (err) {
    return {
      status: 'down',
      activeEndpoints: 0,
      pending: 0,
      oldestPendingAgeMs: null,
      delivered24h: 0,
      failed24h: 0,
      successRate24h: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

interface HeartbeatRow {
  job_key: string;
  last_run_at: string;
  last_status: 'ok' | 'error';
  last_duration_ms: number | null;
  last_detail: Record<string, unknown> | null;
  last_error: string | null;
  run_count: number;
  error_count: number;
}

async function collectCrons(): Promise<CronHealth[]> {
  const db = adminDb();
  let rows: HeartbeatRow[] = [];
  try {
    const { data } = await db
      .from('system_cron_heartbeats')
      .select(
        'job_key, last_run_at, last_status, last_duration_ms, last_detail, last_error, run_count, error_count',
      );
    rows = (data ?? []) as HeartbeatRow[];
  } catch {
    rows = [];
  }
  const byKey = new Map(rows.map((r) => [r.job_key, r]));

  return (Object.keys(KNOWN_CRONS) as CronJobKey[]).map((key) => {
    const meta = KNOWN_CRONS[key];
    const row = byKey.get(key);

    if (!row) {
      return {
        key,
        label: meta.label,
        description: meta.description,
        intervalSeconds: meta.intervalSeconds,
        status: 'unknown',
        lastRunAt: null,
        ageMs: null,
        lastStatus: null,
        lastDurationMs: null,
        runCount: 0,
        errorCount: 0,
        lastError: null,
        detail: {},
      };
    }

    const ageMs = Date.now() - Date.parse(row.last_run_at);
    // Overdue if silent for well past its cadence (3× interval, floored at
    // 5 min) — usually means the external pinger/Cron stopped firing.
    const staleMs = Math.max(5 * 60 * 1000, meta.intervalSeconds * 1000 * 3);
    let status: ServiceStatus = 'operational';
    if (row.last_status === 'error') status = 'down';
    else if (ageMs > staleMs) status = 'degraded';

    return {
      key,
      label: meta.label,
      description: meta.description,
      intervalSeconds: meta.intervalSeconds,
      status,
      lastRunAt: row.last_run_at,
      ageMs,
      lastStatus: row.last_status,
      lastDurationMs: row.last_duration_ms,
      runCount: row.run_count,
      errorCount: row.error_count,
      lastError: row.last_error,
      detail: row.last_detail ?? {},
    };
  });
}

function collectConfig(): ConfigItem[] {
  const present = (name: string) => Boolean(process.env[name]?.trim());
  const items: ConfigItem[] = [
    { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Service role key', group: 'Core', present: present('SUPABASE_SERVICE_ROLE_KEY') },
    { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'Supabase URL', group: 'Core', present: present('NEXT_PUBLIC_SUPABASE_URL') },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', label: 'Supabase anon key', group: 'Core', present: present('NEXT_PUBLIC_SUPABASE_ANON_KEY') },
    { key: 'ENCRYPTION_KEY', label: 'Encryption key', group: 'Core', present: present('ENCRYPTION_KEY') },
    { key: 'ADMIN_EMAILS', label: 'Admin allowlist', group: 'Core', present: present('ADMIN_EMAILS') },
    { key: 'AUTOMATION_CRON_SECRET', label: 'Cron secret', group: 'Automation', present: present('AUTOMATION_CRON_SECRET') },
    { key: 'META_APP_ID', label: 'Meta app ID', group: 'WhatsApp / Meta', present: present('META_APP_ID') || present('NEXT_PUBLIC_META_APP_ID') },
    { key: 'META_APP_SECRET', label: 'Meta app secret', group: 'WhatsApp / Meta', present: present('META_APP_SECRET') },
    { key: 'INSTAGRAM_APP_ID', label: 'Instagram app ID', group: 'Instagram', present: present('INSTAGRAM_APP_ID') || present('NEXT_PUBLIC_INSTAGRAM_APP_ID') },
    { key: 'INSTAGRAM_APP_SECRET', label: 'Instagram app secret', group: 'Instagram', present: present('INSTAGRAM_APP_SECRET') },
    { key: 'SITE_URL', label: 'Public site URL', group: 'Core', present: present('NEXT_PUBLIC_SITE_URL') || present('NEXT_PUBLIC_APP_URL') },
  ];
  return items;
}

function collectRuntime(): RuntimeHealth {
  return {
    status: 'operational',
    uptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV ?? 'unknown',
    healthEndpoint: '/api/health',
  };
}

/** Gather the full system-health snapshot. Never throws. */
export async function collectSystemHealth(): Promise<SystemHealth> {
  const [database, storage, auth, tables, webhooks, crons] = await Promise.all([
    collectDatabase(),
    collectStorage(),
    collectAuth(),
    collectTables(),
    collectWebhooks(),
    collectCrons(),
  ]);
  const runtime = collectRuntime();
  const config = collectConfig();

  const overall = worst(
    database.status,
    storage.status,
    auth.status,
    runtime.status,
    webhooks.status,
    ...crons.map((c) => c.status),
  );

  return {
    generatedAt: new Date().toISOString(),
    overall,
    database,
    storage,
    auth,
    runtime,
    tables,
    webhooks,
    crons,
    config,
  };
}
