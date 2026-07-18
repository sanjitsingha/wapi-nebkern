import type { SupabaseClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/whatsapp/encryption';
import { signBody } from './security';

// ============================================================
// Delivery: sign + POST an event, and drain the pending queue with
// exponential-backoff retries.
// ============================================================

const MAX_ATTEMPTS = 5;
const TIMEOUT_MS = 10_000;
// A claimed row is pushed this far into the future so an overlapping cron
// run won't also pick it up while it's in flight.
const LOCK_MS = 2 * 60 * 1000;

/** Backoff before the next retry, keyed by how many attempts have failed. */
function backoffMs(attempts: number): number {
  const table = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000]; // 1m,5m,30m,2h
  return table[Math.min(attempts, table.length) - 1] ?? table[table.length - 1];
}

export interface WebhookEnvelope {
  id: string;
  event: string;
  created_at: string;
  account_id: string;
  data: unknown;
}

export interface DeliverResult {
  ok: boolean;
  status: number | null;
  error: string | null;
}

/**
 * Sign and POST one event to a URL. Used by both the queue dispatcher and
 * the "send test event" button. Never throws — network/timeout failures
 * come back as `{ ok: false }`.
 */
export async function deliverOne(
  url: string,
  secret: string,
  envelope: WebhookEnvelope,
): Promise<DeliverResult> {
  const body = JSON.stringify(envelope);
  const signature = signBody(secret, body);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'wacrm-webhooks/1',
        'X-Wacrm-Event': envelope.event,
        'X-Wacrm-Delivery': envelope.id,
        'X-Wacrm-Signature': `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return {
      ok: res.ok,
      status: res.status,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

interface EndpointJoin {
  url: string;
  secret: string;
  is_active: boolean;
}

interface DueRow {
  id: string;
  account_id: string;
  event_type: string;
  payload: unknown;
  attempts: number;
  next_retry_at: string;
  created_at: string;
  endpoint: EndpointJoin | EndpointJoin[] | null;
}

/**
 * Drain due, still-pending deliveries. Each row is claimed optimistically
 * (only the run that wins the `next_retry_at` update owns it), then sent;
 * on failure it's retried with backoff up to MAX_ATTEMPTS.
 */
export async function dispatchDueDeliveries(
  db: SupabaseClient,
  limit = 50,
): Promise<{ processed: number; success: number; failed: number }> {
  const nowIso = new Date().toISOString();

  const { data: due, error } = await db
    .from('webhook_deliveries')
    .select(
      'id, account_id, event_type, payload, attempts, next_retry_at, created_at, endpoint:webhook_endpoints(url, secret, is_active)',
    )
    .eq('status', 'pending')
    .lte('next_retry_at', nowIso)
    .order('next_retry_at', { ascending: true })
    .limit(limit);

  if (error || !due || due.length === 0) {
    return { processed: 0, success: 0, failed: 0 };
  }

  let processed = 0;
  let success = 0;
  let failed = 0;

  for (const row of due as DueRow[]) {
    // Claim: push next_retry_at forward, but only if nobody else has
    // touched it since we read it.
    const { data: claimed } = await db
      .from('webhook_deliveries')
      .update({ next_retry_at: new Date(Date.now() + LOCK_MS).toISOString() })
      .eq('id', row.id)
      .eq('status', 'pending')
      .eq('next_retry_at', row.next_retry_at)
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    processed += 1;
    const attempts = row.attempts + 1;
    const endpoint = Array.isArray(row.endpoint) ? row.endpoint[0] : row.endpoint;

    if (!endpoint || !endpoint.is_active) {
      await db
        .from('webhook_deliveries')
        .update({ status: 'failed', attempts, error: 'Endpoint inactive or missing' })
        .eq('id', row.id);
      failed += 1;
      continue;
    }

    let secret: string;
    try {
      secret = decrypt(endpoint.secret);
    } catch {
      await db
        .from('webhook_deliveries')
        .update({ status: 'failed', attempts, error: 'Secret could not be decrypted' })
        .eq('id', row.id);
      failed += 1;
      continue;
    }

    const result = await deliverOne(endpoint.url, secret, {
      id: row.id,
      event: row.event_type,
      created_at: row.created_at,
      account_id: row.account_id,
      data: row.payload,
    });

    if (result.ok) {
      await db
        .from('webhook_deliveries')
        .update({
          status: 'success',
          attempts,
          response_status: result.status,
          error: null,
          delivered_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      success += 1;
    } else if (attempts >= MAX_ATTEMPTS) {
      await db
        .from('webhook_deliveries')
        .update({
          status: 'failed',
          attempts,
          response_status: result.status,
          error: result.error,
        })
        .eq('id', row.id);
      failed += 1;
    } else {
      await db
        .from('webhook_deliveries')
        .update({
          status: 'pending',
          attempts,
          response_status: result.status,
          error: result.error,
          next_retry_at: new Date(Date.now() + backoffMs(attempts)).toISOString(),
        })
        .eq('id', row.id);
    }
  }

  return { processed, success, failed };
}
