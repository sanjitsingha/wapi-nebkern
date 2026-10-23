// ============================================================
// Does this account's plan allow outward work right now?
//
// For the senders nobody clicks: AI replies, automations, flows and
// the public API. They run under the service role from webhooks and
// crons, so the middleware's paywall never stands in front of them, and
// before this a lapsed account kept sending — and kept spending Dripo's
// own AI key — forever.
//
// Answers are kept for a minute per account: a busy inbox asks on every
// message, and a plan changes far less often than that. The cost is that
// a renewal reaches the background senders up to a minute late.
//
// Fails OPEN on a read error, like the send guard: a database blip must
// never silence a paying customer's automations.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'

import { computeSubscription, SUBSCRIPTION_COLUMNS } from './subscription'

const TTL_MS = 60_000
const answers = new Map<string, { at: number; ok: boolean }>()

export async function accountHasAccess(db: SupabaseClient, accountId: string): Promise<boolean> {
  const hit = answers.get(accountId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ok

  const { data, error } = await db
    .from('accounts')
    .select(SUBSCRIPTION_COLUMNS)
    .eq('id', accountId)
    .maybeSingle()
  if (error || !data) return true

  const ok = computeSubscription(data).hasAccess
  answers.set(accountId, { at: Date.now(), ok })
  return ok
}
