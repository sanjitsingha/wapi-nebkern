// ============================================================
// Server-side subscription guards.
//
// Kept separate from subscription.ts (which is pure and imported by
// client code) because this pulls NextResponse / the Supabase server
// types — route-handler territory.
//
// Enforcement policy (docs/billing-and-trial.md §5): an EXPIRED trial
// blocks costly outward actions (send, broadcast) but leaves reads
// intact. This guard is the single seam those routes call.
// ============================================================

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { computeSubscription } from './subscription'

const BLOCK_MESSAGE =
  'Your free trial has ended. Sending is paused until you choose a plan.'

/**
 * Guard for the raw createClient()+accountId route pattern (send /
 * broadcast). Returns a 402 NextResponse to short-circuit with when the
 * account has no access, or `null` when it's clear to proceed.
 *
 * Fails OPEN on a read error: a transient DB blip must never block an
 * active/paying account from sending. The client `supabase` is
 * RLS-scoped, and the account row is readable by its own members
 * (accounts_select), so this needs no service role.
 */
export async function assertActiveSubscription(
  supabase: SupabaseClient,
  accountId: string,
): Promise<NextResponse | null> {
  const { data, error } = await supabase
    .from('accounts')
    .select('plan, subscription_status, trial_started_at, trial_ends_at')
    .eq('id', accountId)
    .maybeSingle()

  if (error || !data) return null // fail open

  const subscription = computeSubscription(data)
  if (subscription.hasAccess) return null

  return NextResponse.json(
    {
      error: BLOCK_MESSAGE,
      code: 'subscription_required',
      status: subscription.status,
    },
    { status: 402 },
  )
}
