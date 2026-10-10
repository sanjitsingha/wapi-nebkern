import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './admin-client';
import type { WebhookEventType } from './events';
import { enqueueSheetEvent } from '@/lib/google-sheets/sync';

/**
 * Fan an event out to the account's subscribed webhook endpoints by
 * queuing a delivery row per endpoint. The cron dispatcher then signs and
 * POSTs them with retries.
 *
 * BEST-EFFORT: this is called from hot paths (inbound message handling,
 * contact creation), so it never throws — a webhook problem must not break
 * the thing that triggered it. Runs under the service-role client by
 * default (emit often happens with no auth.uid()).
 */
export async function emitWebhookEvent(
  accountId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>,
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  // The connected Google Sheet, if any, gets the same events. Before the
  // endpoint lookup because most accounts with a sheet have no webhook
  // endpoints, and that lookup returns early. Never throws.
  await enqueueSheetEvent(db, accountId, eventType, data);

  try {
    const { data: endpoints, error } = await db
      .from('webhook_endpoints')
      .select('id')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .contains('events', [eventType]);

    if (error || !endpoints || endpoints.length === 0) return;

    const rows = endpoints.map((e) => ({
      endpoint_id: e.id as string,
      account_id: accountId,
      event_type: eventType,
      payload: data,
    }));

    await db.from('webhook_deliveries').insert(rows);
  } catch (err) {
    console.error('[webhooks] emit failed:', err);
  }
}
