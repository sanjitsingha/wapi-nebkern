// ============================================================
// Cron heartbeats — liveness tracking for the background jobs.
//
// Every scheduled cron route calls recordCronHeartbeat() on each run so
// the admin System Health console can tell a healthy job from a silently
// dead one (nothing else proves an external pinger is still firing). The
// write goes through the record_cron_heartbeat() RPC (migration 064),
// which upserts atomically and bumps the rolling counters.
//
// Recording is best-effort: a heartbeat failure must NEVER break the
// actual cron work, so every call is wrapped and swallowed.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The jobs we expect to be scheduled, with the cadence the operator
 * should be pinging them at. `intervalSeconds` drives the console's
 * "overdue" detection — a job silent for well past its interval is
 * flagged, which usually means the external pinger/Cron stopped.
 */
export const KNOWN_CRONS = {
  webhooks_dispatch: {
    label: 'Webhook dispatcher',
    description: 'Drains the outbound webhook delivery queue',
    intervalSeconds: 60,
  },
  broadcasts: {
    label: 'Broadcast scheduler',
    description: 'Sends due scheduled broadcast campaigns',
    intervalSeconds: 60,
  },
  automations: {
    label: 'Automations engine',
    description: 'Resumes due automation steps',
    intervalSeconds: 60,
  },
  flows: {
    label: 'Flows timeout sweep',
    description: 'Times out abandoned chatbot flow runs',
    intervalSeconds: 300,
  },
} as const;

export type CronJobKey = keyof typeof KNOWN_CRONS;

export interface HeartbeatOptions {
  status: 'ok' | 'error';
  durationMs: number;
  /** Small run summary, e.g. { processed: 5 } or { swept: 0 }. */
  detail?: Record<string, unknown>;
  /** Error message when status is 'error'. */
  error?: string | null;
}

/**
 * Record one cron run. Never throws — a telemetry write must not take
 * down the job it's measuring.
 */
export async function recordCronHeartbeat(
  db: SupabaseClient,
  jobKey: CronJobKey,
  opts: HeartbeatOptions,
): Promise<void> {
  try {
    await db.rpc('record_cron_heartbeat', {
      p_job_key: jobKey,
      p_status: opts.status,
      p_duration_ms: Math.max(0, Math.round(opts.durationMs)),
      p_detail: opts.detail ?? {},
      p_error: opts.error ?? null,
    });
  } catch (err) {
    console.error(`[cron-heartbeat] failed to record ${jobKey}:`, err);
  }
}
