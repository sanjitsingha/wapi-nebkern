import { NextResponse } from 'next/server'

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { loadWhatsAppAccess } from '@/lib/whatsapp/server-config'

/**
 * GET /api/whatsapp/connection
 *
 * Whether this account has usable WhatsApp credentials stored, for a
 * number Meta finished registering. Two small database reads and a
 * decrypt — deliberately no call to Meta.
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

    const [access, { data: row }] = await Promise.all([
      loadWhatsAppAccess(supabase, accountId),
      supabase.from('whatsapp_config').select('status').eq('account_id', accountId).maybeSingle(),
    ])

    // `reason` distinguishes "never set up" from "set up, but the token
    // no longer decrypts" — a different sentence and a different fix.
    if (!access.ok) return NextResponse.json({ connected: false, reason: access.reason })

    // Saved, but Meta never finished registering the number (it wanted
    // the number's PIN, or the number is still on the WhatsApp app): the
    // connect flows keep the row with status 'disconnected' so Settings
    // can offer to finish, and nothing is sent or received until then.
    // Rows from before `status` existed carry no such mark and stay
    // connected.
    if (row?.status === 'disconnected') {
      return NextResponse.json({ connected: false, reason: 'not_registered' })
    }

    return NextResponse.json({ connected: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
