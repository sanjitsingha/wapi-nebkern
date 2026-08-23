import { NextResponse } from 'next/server'

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { loadWhatsAppAccess } from '@/lib/whatsapp/server-config'

/**
 * GET /api/whatsapp/connection
 *
 * Whether this account has usable WhatsApp credentials stored. One
 * database read and a decrypt — deliberately no call to Meta.
 *
 * WHY NOT REUSE /api/whatsapp/config OR /api/whatsapp/phone-health
 *
 * Cost: both ask Meta to validate the number. That is right on the
 * settings screen, where someone is watching a connect succeed, and
 * wrong for something that runs on every page load in the app shell —
 * it would put a Meta round trip in front of every navigation.
 *
 * Meaning: both report `configured: false` when Meta merely hiccups.
 * That is fine for hiding a status badge, but not for a banner that
 * says "you have not connected yet" — a slow minute at Meta would nag
 * a fully connected account to go and set itself up again. This route
 * answers the narrower question it is actually asked: is there a
 * credential in OUR database. Whether Meta still likes it is a
 * different question, and the settings screen is where it gets asked.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()

    const access = await loadWhatsAppAccess(supabase, accountId)
    if (access.ok) return NextResponse.json({ connected: true })

    // `reason` distinguishes "never set up" from "set up, but the token
    // no longer decrypts" — a different sentence and a different fix.
    return NextResponse.json({ connected: false, reason: access.reason })
  } catch (err) {
    return toErrorResponse(err)
  }
}
