import { NextResponse } from 'next/server'

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { loadWhatsAppAccess } from '@/lib/whatsapp/server-config'
import {
  getConversationUsage,
  getExtendedCredits,
  getOwningBusiness,
} from '@/lib/whatsapp/billing'

/**
 * Best-effort credit-line status. Postpaid accounts bill against an
 * extended credit line on the WABA's owning business — but reading it
 * needs business_management + business access the token may not have, so
 * ANY failure resolves to null ("unknown") rather than breaking the
 * usage response. Returns:
 *   { attached: boolean, legalEntityName: string | null }  when readable
 *   null                                                    when unknown
 */
async function resolveCreditLine(
  wabaId: string,
  accessToken: string,
): Promise<{ attached: boolean; legalEntityName: string | null } | null> {
  try {
    const business = await getOwningBusiness({ wabaId, accessToken })
    if (!business) return null
    const credits = await getExtendedCredits({
      businessId: business.id,
      accessToken,
    })
    return {
      attached: credits.length > 0,
      legalEntityName: credits[0]?.legalEntityName ?? null,
    }
  } catch {
    return null
  }
}

/**
 * GET /api/whatsapp/billing
 *
 * Estimated WhatsApp spend for the current calendar-month billing period,
 * derived from Meta's conversation COST analytics on the WABA. There is no
 * Meta "wallet balance" API (see src/lib/whatsapp/billing.ts) — this is the
 * closest programmatic figure.
 *
 * Any account member can read it. Returns 200 in every non-auth case so the
 * settings panel can render the right state:
 *   { configured: true, currency, estimatedCost, conversations, byCategory,
 *     periodStart, periodEnd }
 *   { configured: false, reason, message }
 *
 * The `meta_api_error` branch is expected for accounts whose Meta business
 * isn't verified/live yet or whose token lacks whatsapp_business_management
 * — the panel surfaces that as "usage not available yet" rather than an
 * error.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()

    const access = await loadWhatsAppAccess(supabase, accountId)
    if (!access.ok) {
      return NextResponse.json({
        configured: false,
        reason: access.reason,
        message:
          access.reason === 'no_config'
            ? 'WhatsApp is not connected yet. Connect it under Settings → WhatsApp first.'
            : 'The stored WhatsApp access token could not be decrypted. Reset and re-save your connection under Settings → WhatsApp.',
      })
    }

    if (!access.access.wabaId) {
      return NextResponse.json({
        configured: false,
        reason: 'no_waba',
        message:
          'This connection has no WhatsApp Business Account (WABA) id, which is required to read usage. Reconnect WhatsApp under Settings → WhatsApp.',
      })
    }

    // Meta bills per calendar month (UTC). Scope the window to the current
    // month-to-date so the figure lines up with the invoice period.
    const now = new Date()
    const periodStartDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    )
    const start = Math.floor(periodStartDate.getTime() / 1000)
    const end = Math.floor(now.getTime() / 1000)

    try {
      const usage = await getConversationUsage({
        wabaId: access.access.wabaId,
        accessToken: access.access.accessToken,
        start,
        end,
      })
      // Credit-line status is a separate, best-effort read — never let it
      // fail the usage response (see resolveCreditLine).
      const creditLine = await resolveCreditLine(
        access.access.wabaId,
        access.access.accessToken,
      )
      return NextResponse.json({
        configured: true,
        currency: usage.currency,
        estimatedCost: usage.totalCost,
        conversations: usage.totalConversations,
        byCategory: usage.byCategory,
        creditLine,
        periodStart: start,
        periodEnd: end,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({
        configured: false,
        reason: 'meta_api_error',
        message: `Meta could not return usage analytics for this account: ${message}. This is expected until the client's Meta business is verified and the number is live.`,
      })
    }
  } catch (err) {
    return toErrorResponse(err)
  }
}
