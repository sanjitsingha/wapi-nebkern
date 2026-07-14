import { NextResponse } from 'next/server'

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { loadWhatsAppAccess } from '@/lib/whatsapp/server-config'
import { getPhoneHealth } from '@/lib/whatsapp/meta-api'

/**
 * GET /api/whatsapp/phone-health
 *
 * The connected number's Meta health signals — quality rating and messaging
 * limit tier — for the header account menu.
 *
 * Always 200 outside of auth failures: a number that isn't connected, or a
 * Meta hiccup, resolves to `{ configured: false }` so the menu simply omits
 * the badges rather than erroring. Deliberately separate from
 * /api/whatsapp/config so it can never affect connect/verify.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()

    const access = await loadWhatsAppAccess(supabase, accountId)
    if (!access.ok) {
      return NextResponse.json({ configured: false })
    }

    try {
      const health = await getPhoneHealth({
        phoneNumberId: access.access.phoneNumberId,
        accessToken: access.access.accessToken,
      })
      return NextResponse.json({
        configured: true,
        qualityRating: health.qualityRating,
        messagingLimitTier: health.messagingLimitTier,
      })
    } catch {
      // Meta refused (permissions, unknown field, transient) — the badges
      // are non-essential, so degrade to "unknown" rather than surfacing it.
      return NextResponse.json({ configured: false })
    }
  } catch (err) {
    return toErrorResponse(err)
  }
}
