import type { SupabaseClient } from '@supabase/supabase-js';

import { sendTemplateMessage } from '@/lib/whatsapp/meta-api';
import { decrypt } from '@/lib/whatsapp/encryption';
import { isMessageTemplate } from '@/lib/whatsapp/template-row-guard';
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
} from '@/lib/whatsapp/phone-utils';
import { assertActiveSubscription } from '@/lib/billing/guard';
import { resolveVariables, type VariableMapping } from '@/lib/broadcasts/variables';
import type { Contact } from '@/types';

/**
 * Server-side scheduled-broadcast dispatcher.
 *
 * A scheduled broadcast is created with its recipient rows already
 * materialized (see `createScheduledBroadcast` in the send hook), so this
 * module never re-resolves an audience — it loads the pending recipients,
 * sends each via Meta, and lets the aggregate DB trigger (migration 003)
 * keep the broadcast counts in sync. The final `status` flip is the only
 * thing written on the broadcast row itself.
 *
 * Mirrors the batch cadence + per-recipient variant/opt-out handling of
 * the browser send path (`useBroadcastSending`) and `/api/whatsapp/broadcast`
 * so scheduled and immediate sends behave identically.
 */

// Matches the immediate-send hook: 10 per batch + 1 s pause stays under
// Meta's per-number messaging rate.
const SEND_BATCH_SIZE = 10;
const SEND_BATCH_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface DueBroadcast {
  id: string;
  account_id: string;
  template_name: string;
  template_language: string | null;
  template_variables: Record<string, VariableMapping> | null;
}

type RecipientRow = {
  id: string;
  contact: (Contact & { marketing_opt_out?: boolean }) | null;
};

/** contactId → (customFieldId → value). */
async function fetchCustomValueIndex(
  admin: SupabaseClient,
  contactIds: string[],
): Promise<Map<string, Map<string, string>>> {
  const index = new Map<string, Map<string, string>>();
  if (contactIds.length === 0) return index;

  const PAGE = 500;
  for (let i = 0; i < contactIds.length; i += PAGE) {
    const slice = contactIds.slice(i, i + PAGE);
    const { data } = await admin
      .from('contact_custom_values')
      .select('contact_id, custom_field_id, value')
      .in('contact_id', slice);
    for (const row of data ?? []) {
      const bucket = index.get(row.contact_id) ?? new Map<string, string>();
      bucket.set(row.custom_field_id, row.value ?? '');
      index.set(row.contact_id, bucket);
    }
  }
  return index;
}

/**
 * Send one already-scheduled broadcast. The caller is responsible for
 * claiming it first (flipping `scheduled` → `sending`) so concurrent cron
 * invocations don't double-send. Returns a small result summary for logs.
 */
export async function dispatchScheduledBroadcast(
  admin: SupabaseClient,
  broadcast: DueBroadcast,
): Promise<{ id: string; sent: number; failed: number; skipped: number }> {
  const language = broadcast.template_language || 'en_US';
  const variables = broadcast.template_variables ?? {};

  // Trial/subscription gate — the immediate send enforces this in the
  // API route, so a scheduled send must too, or an expired account could
  // keep firing campaigns queued before expiry.
  const blocked = await assertActiveSubscription(admin, broadcast.account_id);
  if (blocked) {
    await failBroadcast(admin, broadcast.id);
    return { id: broadcast.id, sent: 0, failed: 0, skipped: 0 };
  }

  const { data: config } = await admin
    .from('whatsapp_config')
    .select('*')
    .eq('account_id', broadcast.account_id)
    .single();
  if (!config) {
    await failBroadcast(admin, broadcast.id);
    return { id: broadcast.id, sent: 0, failed: 0, skipped: 0 };
  }

  const accessToken = decrypt(config.access_token);

  const { data: rawTemplateRow } = await admin
    .from('message_templates')
    .select('*')
    .eq('account_id', broadcast.account_id)
    .eq('name', broadcast.template_name)
    .eq('language', language)
    .maybeSingle();
  const templateRow =
    rawTemplateRow && isMessageTemplate(rawTemplateRow) ? rawTemplateRow : null;

  const { data: recipients } = await admin
    .from('broadcast_recipients')
    .select('id, contact:contacts(*)')
    .eq('broadcast_id', broadcast.id)
    .eq('status', 'pending');

  const rows = (recipients ?? []) as unknown as RecipientRow[];
  if (rows.length === 0) {
    // Nothing left to send (already dispatched, or empty) — settle it.
    await admin.from('broadcasts').update({ status: 'sent' }).eq('id', broadcast.id);
    return { id: broadcast.id, sent: 0, failed: 0, skipped: 0 };
  }

  const contactIds = rows
    .map((r) => r.contact?.id)
    .filter((id): id is string => Boolean(id));
  const customValueIndex = await fetchCustomValueIndex(admin, contactIds);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += SEND_BATCH_SIZE) {
    const batch = rows.slice(i, i + SEND_BATCH_SIZE);

    for (const row of batch) {
      const contact = row.contact;
      const phone = contact?.phone ?? null;

      if (!phone) {
        failed++;
        await admin
          .from('broadcast_recipients')
          .update({ status: 'failed', error_message: 'No phone number on contact' })
          .eq('id', row.id);
        continue;
      }

      // Re-check opt-out at send time — a contact may have replied STOP
      // between scheduling and dispatch.
      if (contact?.marketing_opt_out) {
        skipped++;
        await admin
          .from('broadcast_recipients')
          .update({
            status: 'failed',
            error_message: 'Contact has opted out of messages (STOP) — not sent',
          })
          .eq('id', row.id);
        continue;
      }

      const sanitized = sanitizePhoneForMeta(phone);
      if (!isValidE164(sanitized)) {
        failed++;
        await admin
          .from('broadcast_recipients')
          .update({ status: 'failed', error_message: 'Invalid phone number format' })
          .eq('id', row.id);
        continue;
      }

      const params = contact
        ? resolveVariables(variables, contact, customValueIndex.get(contact.id))
        : [];

      // Retry across phone variants on "not in allowed list" so a trunk-
      // prefix 0 difference still reaches the recipient.
      const variants = phoneVariants(sanitized);
      let sentMessageId: string | null = null;
      let lastError: string | null = null;

      for (const variant of variants) {
        try {
          const result = await sendTemplateMessage({
            phoneNumberId: config.phone_number_id,
            accessToken,
            to: variant,
            templateName: broadcast.template_name,
            language,
            template: templateRow ?? undefined,
            params,
          });
          sentMessageId = result.messageId;
          lastError = null;
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          lastError = message;
          if (!isRecipientNotAllowedError(message)) break;
          // else retry with next variant
        }
      }

      if (sentMessageId) {
        sent++;
        await admin
          .from('broadcast_recipients')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            whatsapp_message_id: sentMessageId,
            error_message: null,
          })
          .eq('id', row.id);
      } else {
        failed++;
        await admin
          .from('broadcast_recipients')
          .update({ status: 'failed', error_message: lastError ?? 'Unknown error' })
          .eq('id', row.id);
      }
    }

    if (i + SEND_BATCH_SIZE < rows.length) {
      await sleep(SEND_BATCH_DELAY_MS);
    }
  }

  // Only a total wipeout counts as a failed broadcast; a partial failure
  // is still a completed send with per-recipient errors recorded.
  const finalStatus = sent === 0 ? 'failed' : 'sent';
  await admin
    .from('broadcasts')
    .update({ status: finalStatus })
    .eq('id', broadcast.id);

  return { id: broadcast.id, sent, failed, skipped };
}

async function failBroadcast(admin: SupabaseClient, id: string) {
  await admin.from('broadcasts').update({ status: 'failed' }).eq('id', id);
}
