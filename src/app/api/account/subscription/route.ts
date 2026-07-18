import { NextResponse } from 'next/server'

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { computeSubscription } from '@/lib/billing/subscription'

/** The account's assigned paid-billing arrangement (migration 054), or
 *  null when it's on trial / grandfathered with nothing assigned. */
export interface AccountBilling {
  planKey: string | null
  planName: string | null
  amount: number | null
  currency: string
  interval: 'monthly' | 'yearly' | null
  periodStart: string | null
  periodEnd: string | null
}

/**
 * GET /api/account/subscription
 *
 * The server's source of truth for the caller's subscription/trial state,
 * with trial expiry folded in (computeSubscription), plus the billing
 * arrangement the admin assigned (plan name, price, current period). Any
 * account member can read it. Also the authoritative check behind the
 * send/broadcast guard.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()

    const { data } = await supabase
      .from('accounts')
      .select(
        'plan, subscription_status, trial_started_at, trial_ends_at, billing_plan_key, billing_amount, billing_currency, billing_interval, current_period_start, current_period_end',
      )
      .eq('id', accountId)
      .maybeSingle()

    let billing: AccountBilling | null = null
    if (data && (data.billing_plan_key || data.billing_amount != null)) {
      // Resolve the (admin-editable) plan display name. The billing_plans
      // SELECT policy lets members read active plans; if it's been
      // deactivated the name comes back null and the client falls back to
      // the key.
      let planName: string | null = null
      if (data.billing_plan_key) {
        const { data: plan } = await supabase
          .from('billing_plans')
          .select('name')
          .eq('key', data.billing_plan_key)
          .maybeSingle()
        planName = plan?.name ?? null
      }
      billing = {
        planKey: data.billing_plan_key ?? null,
        planName,
        amount: data.billing_amount ?? null,
        currency: data.billing_currency ?? 'INR',
        interval: data.billing_interval ?? null,
        periodStart: data.current_period_start ?? null,
        periodEnd: data.current_period_end ?? null,
      }
    }

    return NextResponse.json({
      subscription: computeSubscription(data),
      billing,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
