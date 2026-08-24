// ============================================================
// Shared types and constants for Supabase Usage & Quotas
// Safe for both client and server components.
// ============================================================

export const FREE_TIER_LIMITS = {
  dbSizeBytes: 500 * 1024 * 1024, // 500 MB
  storageSizeBytes: 1024 * 1024 * 1024, // 1 GB
  mauLimit: 50_000, // 50,000 monthly active users
  projectsLimit: 2, // 2 active projects per org
  edgeFunctionsLimit: 500_000, // 500k invocations/month
  realtimeMessagesLimit: 2_000_000, // 2M messages/month
  bandwidthEgressBytes: 5 * 1024 * 1024 * 1024, // 5 GB
  inactivityPauseDays: 7, // pauses after 7 days idle
} as const;

export interface SupabaseQuota {
  key: string;
  label: string;
  used: number;
  limit: number;
  usedFormatted: string;
  limitFormatted: string;
  fraction: number; // 0..1 clamped
  percentage: number; // 0..100
  unit: string;
  tone: 'good' | 'warning' | 'critical';
}

export interface TableStorageItem {
  name: string;
  bytes: number;
  estRows: number;
  formattedSize: string;
}

export interface BucketStorageItem {
  bucket: string;
  objects: number;
  bytes: number;
  formattedSize: string;
}

export interface SignupTrendDay {
  day: string;
  label: string;
  signups: number;
}

export interface InactivityGuard {
  status: 'safe' | 'warning' | 'paused';
  daysInactive: number;
  maxIdleDays: number;
  lastActivityAt: string;
  detail: string;
}

export interface SupabaseUsageData {
  generatedAt: string;
  project: {
    id: string;
    name: string;
    region: string;
    status: string;
    plan: string;
    organization: string;
    dbHost: string;
    postgresVersion: string;
  };
  quotas: {
    database: SupabaseQuota;
    storage: SupabaseQuota;
    mau: SupabaseQuota;
    projects: SupabaseQuota;
    edgeFunctions: SupabaseQuota;
    realtimeMessages: SupabaseQuota;
    bandwidthEgress: SupabaseQuota;
  };
  database: {
    sizeBytes: number;
    activeConnections: number;
    maxConnections: number;
    latencyMs: number;
    topTables: TableStorageItem[];
  };
  storage: {
    totalBytes: number;
    totalObjects: number;
    buckets: BucketStorageItem[];
  };
  auth: {
    total: number;
    confirmed: number;
    unconfirmed: number;
    new24h: number;
    new7d: number;
    active24h: number;
    signupTrend: SignupTrendDay[];
  };
  inactivityGuard: InactivityGuard;
}

export function fmtBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function fmtNumber(n: number | null | undefined): string {
  if (n == null) return '0';
  return n.toLocaleString();
}
