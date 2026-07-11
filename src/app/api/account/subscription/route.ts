import { NextResponse } from 'next/server'

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { computeSubscription } from '@/lib/billing/subscription'

/**
 * GET /api/account/subscription
 *
 * The server's source of truth for the caller's subscription/trial state,
 * with trial expiry folded in (computeSubscription). Any account member
 * can read it. Used by the trial banner / future billing page and as the
 * authoritative check behind the send/broadcast guard.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()

    const { data } = await supabase
      .from('accounts')
      .select('plan, subscription_status, trial_started_at, trial_ends_at')
      .eq('id', accountId)
      .maybeSingle()

    return NextResponse.json({ subscription: computeSubscription(data) })
  } catch (err) {
    return toErrorResponse(err)
  }
}
