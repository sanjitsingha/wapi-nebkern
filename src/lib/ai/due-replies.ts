import type { SupabaseClient } from '@supabase/supabase-js'

import { triggerAiReplyEngine } from './dispatch'

/**
 * Finish the response-delay waits nobody is holding.
 *
 * The reply engine waits in memory only up to IN_PROCESS_WAIT_MAX_MS
 * (auto-reply.ts). A longer delay — up to RESPONSE_DELAY.max — leaves
 * its deadline in conversations.ai_debounce_deadline and returns; so
 * does a short one whose invocation died with a restart. The minute
 * cron calls this to hand each passed deadline back to the engine with
 * its `dueSeq`, which claims it atomically: a reply can never go out
 * twice, and a deadline superseded by a newer message simply fails the
 * claim.
 */

/** A just-passed deadline belongs to the invocation still polling it. */
const GRACE_MS = 15_000
/** Later than this, a reply would land stale; leave it unanswered. */
const MAX_LATE_MS = 30 * 60_000
const MAX_PER_RUN = 25

export async function sweepDueAiReplies(
  db: SupabaseClient,
  origin: string,
): Promise<{ due: number }> {
  const now = Date.now()
  const { data: rows, error } = await db
    .from('conversations')
    .select('id, account_id, contact_id, ai_debounce_seq')
    .not('ai_debounce_deadline', 'is', null)
    .lte('ai_debounce_deadline', new Date(now - GRACE_MS).toISOString())
    .gte('ai_debounce_deadline', new Date(now - MAX_LATE_MS).toISOString())
    .order('ai_debounce_deadline', { ascending: true })
    .limit(MAX_PER_RUN)
  if (error) throw error
  if (!rows || rows.length === 0) return { due: 0 }

  // The send's audit columns name the account's WhatsApp config owner,
  // as the webhook does when it starts the reply.
  const accountIds = [...new Set(rows.map((r) => r.account_id as string))]
  const { data: owners } = await db
    .from('whatsapp_config')
    .select('account_id, user_id')
    .in('account_id', accountIds)
  const ownerOf = new Map((owners ?? []).map((o) => [o.account_id as string, o.user_id as string]))

  // Each hand-off waits at most ~2s (triggerAiReplyEngine); the replies
  // themselves run in their own engine invocations, off the cron's clock.
  await Promise.all(
    rows.map(async (row) => {
      const configOwnerUserId = ownerOf.get(row.account_id as string)
      if (!configOwnerUserId) return
      await triggerAiReplyEngine(origin, {
        accountId: row.account_id as string,
        conversationId: row.id as string,
        contactId: row.contact_id as string,
        configOwnerUserId,
        messageText: '',
        dueSeq: Number(row.ai_debounce_seq),
      })
    }),
  )
  return { due: rows.length }
}
