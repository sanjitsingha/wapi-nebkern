// ============================================================
// Automatic sync through Zoho's Notification API (server only).
//
// Instead of asking the admin to build a Workflow Rule, Instant
// subscribes a "channel" at connect time: Zoho then POSTs to our
// webhook URL whenever a watched record is created or edited.
//
//   POST   {api_domain}/crm/v5/actions/watch    subscribe
//   PATCH  {api_domain}/crm/v5/actions/watch    renew / change events
//   DELETE {api_domain}/crm/v5/actions/watch?channel_ids=…
//
// ── What a notification carries ──
//
// Only ids — `{ module, ids, operation, channel_id, token }` — never
// the record. Each id is read back through enrichZohoRecord, the same
// path a thin Workflow Rule event already takes.
//
// ── It expires ──
//
// A channel lives a week at most. We ask for CHANNEL_LIFETIME_DAYS and
// the zoho cron renews anything inside RENEW_WITHIN_DAYS of lapsing,
// hourly. A missed run or two costs nothing; a dead scheduler for days
// would, which is why the expiry is shown in Settings.
// ============================================================

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { zohoApiFetch } from './api';
import type { ZohoNormalized } from './payload';

import { sanitizeWatchEvents } from './watch-events';

export { ZOHO_WATCH_EVENTS, sanitizeWatchEvents, DEFAULT_WATCH_EVENTS } from './watch-events';
export type { ZohoWatchKey } from './watch-events';

export const CHANNEL_LIFETIME_DAYS = 6;
export const RENEW_WITHIN_DAYS = 2;

const DAY_MS = 24 * 3600 * 1000;

/** Zoho wants `yyyy-MM-ddTHH:mm:ss±HH:mm` — no milliseconds, no `Z`. */
export function zohoExpiry(from: number = Date.now()): string {
  return new Date(from + CHANNEL_LIFETIME_DAYS * DAY_MS)
    .toISOString()
    .replace(/\.\d{3}Z$/, '+00:00');
}

/** Where Zoho should POST. The site's canonical address, like the
 *  OAuth redirect URI, because the cron has no request to read it from. */
export function zohoNotifyUrl(webhookToken: string): string | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
  if (!site) return null;
  return `${site}/api/integrations/zoho/webhook/${webhookToken}`;
}

/** A channel id: Zoho requires a number. 15 digits stays well inside
 *  a Java long and is unique enough per connection. */
function newChannelId(): string {
  const n = crypto.randomInt(1, 9);
  let s = String(n);
  while (s.length < 15) s += String(crypto.randomInt(0, 10));
  return s;
}

// ── Notifications in ────────────────────────────────────────

export interface ZohoNotification {
  module: string;
  ids: string[];
  operation: 'insert' | 'update' | 'delete' | string;
  channelId: string;
  token: string | null;
}

/** Recognise a Notification API delivery, as opposed to a Workflow
 *  Rule webhook. Null when the body is not one. */
export function parseZohoNotification(body: unknown): ZohoNotification | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (b.channel_id === undefined || !Array.isArray(b.ids)) return null;
  if (typeof b.module !== 'string' || typeof b.operation !== 'string') return null;
  const ids = b.ids
    .map((v) => (typeof v === 'string' || typeof v === 'number' ? String(v) : null))
    .filter((v): v is string => !!v);
  return {
    module: b.module,
    ids,
    operation: b.operation,
    channelId: String(b.channel_id),
    token: typeof b.token === 'string' ? b.token : null,
  };
}

const SINGULAR: Record<string, string> = {
  leads: 'lead',
  contacts: 'contact',
  deals: 'deal',
  potentials: 'deal',
};

const VERB: Record<string, string> = {
  insert: 'created',
  create: 'created',
  update: 'updated',
  edit: 'updated',
  delete: 'deleted',
};

/** `Leads` + `insert` → `lead.created`, matching ZOHO_WATCH_EVENTS. */
export function notificationEventType(module: string, operation: string): string {
  const noun = SINGULAR[module.toLowerCase()] ?? module.toLowerCase();
  const verb = VERB[operation.toLowerCase()] ?? operation.toLowerCase();
  return `${noun}.${verb}`;
}

/** One id of a notification, shaped like a parsed webhook so the rest
 *  of the pipeline (enrich → ingest → automations) is shared. */
export function notificationRecord(n: ZohoNotification, id: string): ZohoNormalized {
  const eventType = notificationEventType(n.module, n.operation);
  return {
    phone: null,
    name: null,
    email: null,
    eventType,
    module: n.module,
    recordId: id,
    vars: { event: eventType },
  };
}

// ── Channel management ──────────────────────────────────────

interface WatchRow {
  id: string;
  account_id: string;
  webhook_token: string;
  is_active: boolean;
  auto_sync: boolean;
  watch_events: string[] | null;
  watch_channel_id: string | null;
  watch_token: string | null;
  watch_expires_at: string | null;
}

export const WATCH_SELECT =
  'id, account_id, webhook_token, is_active, auto_sync, watch_events, watch_channel_id, watch_token, watch_expires_at';

interface WatchResponse {
  watch?: {
    code?: string;
    status?: string;
    message?: string;
    details?: { events?: { channel_expiry?: string }[] };
  }[];
}

/** Plain words for what Zoho said, or for why we could not ask. */
function explain(error: string | undefined, code?: string): string {
  const text = `${code ?? ''} ${error ?? ''}`;
  if (/scope/i.test(text)) {
    return 'Reconnect Zoho to allow automatic sync — this connection was made before Instant asked for notification access.';
  }
  if (/not.*(available|supported)|edition|feature/i.test(text)) {
    return 'Your Zoho edition does not support automatic sync. Use a Workflow Rule instead.';
  }
  return error || 'Zoho refused the automatic sync request.';
}

async function callWatch(
  db: SupabaseClient,
  row: WatchRow,
  method: 'POST' | 'PATCH',
  channelId: string,
  token: string,
  events: string[],
  notifyUrl: string,
): Promise<{ ok: true; expiresAt: string } | { ok: false; error: string }> {
  const expiry = zohoExpiry();
  const res = await zohoApiFetch<WatchResponse>(db, row.account_id, '/crm/v5/actions/watch', {
    method,
    body: JSON.stringify({
      watch: [
        {
          channel_id: channelId,
          events,
          channel_expiry: expiry,
          token,
          notify_url: notifyUrl,
        },
      ],
    }),
  });
  if (res.error) return { ok: false, error: explain(res.error) };
  const first = res.data?.watch?.[0];
  if (!first || first.status !== 'success') {
    return { ok: false, error: explain(first?.message, first?.code) };
  }
  const zohoExpiryAt = first.details?.events?.[0]?.channel_expiry;
  const at = zohoExpiryAt ? Date.parse(zohoExpiryAt) : NaN;
  return {
    ok: true,
    expiresAt: new Date(Number.isNaN(at) ? Date.parse(expiry) : at).toISOString(),
  };
}

/** Remove the channel in Zoho. Best effort: a channel we cannot reach
 *  lapses on its own within CHANNEL_LIFETIME_DAYS. */
export async function unsubscribeZohoWatch(
  db: SupabaseClient,
  accountId: string,
  channelId: string,
): Promise<void> {
  await zohoApiFetch(
    db,
    accountId,
    `/crm/v5/actions/watch?channel_ids=${encodeURIComponent(channelId)}`,
    { method: 'DELETE' },
  );
}

export interface WatchSyncResult {
  /** 'active' — subscribed or renewed; 'off' — nothing to watch;
   *  'error' — see `error`. */
  state: 'active' | 'off' | 'error';
  error?: string;
  expiresAt?: string;
}

/**
 * Bring the Zoho channel in line with the row: subscribe when there is
 * none, renew (and apply any event change) when there is, remove it
 * when auto sync is off or no events are chosen. Writes the outcome
 * back to the row, so callers only need the summary.
 */
export async function syncZohoWatch(
  db: SupabaseClient,
  accountId: string,
): Promise<WatchSyncResult> {
  const { data } = await db
    .from('zoho_connections')
    .select(WATCH_SELECT)
    .eq('account_id', accountId)
    .maybeSingle();
  const row = data as WatchRow | null;
  if (!row || !row.is_active) return { state: 'off' };

  const now = new Date().toISOString();
  const events = sanitizeWatchEvents(row.watch_events ?? []);

  if (!row.auto_sync || events.length === 0) {
    if (row.watch_channel_id) {
      await unsubscribeZohoWatch(db, accountId, row.watch_channel_id);
    }
    await db
      .from('zoho_connections')
      .update({
        watch_channel_id: null,
        watch_token: null,
        watch_expires_at: null,
        watch_error: null,
        watch_checked_at: now,
      })
      .eq('id', row.id);
    return { state: 'off' };
  }

  const notifyUrl = zohoNotifyUrl(row.webhook_token);
  if (!notifyUrl) {
    const error = 'NEXT_PUBLIC_SITE_URL is not set on this server, so Zoho has nowhere to send events.';
    await db
      .from('zoho_connections')
      .update({ watch_error: error, watch_checked_at: now })
      .eq('id', row.id);
    return { state: 'error', error };
  }

  const token = row.watch_token ?? crypto.randomBytes(16).toString('hex');
  let channelId = row.watch_channel_id;
  let result = channelId
    ? await callWatch(db, row, 'PATCH', channelId, token, events, notifyUrl)
    : null;

  // No channel yet, or Zoho no longer knows the one we had (it lapsed,
  // or was removed on their side): start a fresh one.
  if (!result || !result.ok) {
    // Drop the old one first where there was one: the webhook only
    // accepts the current channel id, but a stray channel still costs
    // Zoho deliveries until it lapses.
    if (channelId) await unsubscribeZohoWatch(db, accountId, channelId);
    channelId = newChannelId();
    result = await callWatch(db, row, 'POST', channelId, token, events, notifyUrl);
  }

  if (!result.ok) {
    await db
      .from('zoho_connections')
      .update({
        watch_channel_id: null,
        watch_expires_at: null,
        watch_error: result.error,
        watch_checked_at: now,
      })
      .eq('id', row.id);
    return { state: 'error', error: result.error };
  }

  await db
    .from('zoho_connections')
    .update({
      watch_channel_id: channelId,
      watch_token: token,
      watch_expires_at: result.expiresAt,
      watch_error: null,
      watch_checked_at: now,
    })
    .eq('id', row.id);
  return { state: 'active', expiresAt: result.expiresAt };
}

/** Rows the cron should touch: live channels near expiry, and rows
 *  with no channel whose last attempt was over a day ago. */
export function dueWatchFilter(now: number = Date.now()): string {
  const renewBefore = new Date(now + RENEW_WITHIN_DAYS * DAY_MS).toISOString();
  const retryAfter = new Date(now - DAY_MS).toISOString();
  return [
    `and(watch_channel_id.not.is.null,watch_expires_at.lt.${renewBefore})`,
    `and(watch_channel_id.is.null,watch_checked_at.is.null)`,
    `and(watch_channel_id.is.null,watch_checked_at.lt.${retryAfter})`,
  ].join(',');
}
