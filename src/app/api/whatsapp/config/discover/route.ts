import { NextResponse } from 'next/server'

import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { ConnectFlowError, discoverPhoneNumbers } from '@/lib/whatsapp/connect-flow'

/**
 * POST /api/whatsapp/config/discover
 *
 * The first half of "connect with an access token": from the token
 * alone, list every WhatsApp number it can connect, so nobody copies a
 * Phone Number ID or WABA ID out of Meta's dashboards. Nothing is
 * saved — the token is used for the lookup and dropped. The chosen
 * number is then saved through POST /api/whatsapp/config.
 *
 * Body: { access_token: string }
 * 200:  { numbers: DiscoveredNumber[], sameApp: boolean | null }
 * 400:  { error } — a problem with the token the person can fix
 */
export async function POST(request: Request) {
  try {
    await requireRole('admin')

    const body = (await request.json().catch(() => ({}))) as { access_token?: unknown }
    const accessToken = typeof body.access_token === 'string' ? body.access_token.trim() : ''
    if (!accessToken) {
      return NextResponse.json({ error: 'Paste your access token first.' }, { status: 400 })
    }

    try {
      const result = await discoverPhoneNumbers({
        accessToken,
        appId: process.env.META_APP_ID,
        appSecret: process.env.META_APP_SECRET,
      })
      return NextResponse.json(result)
    } catch (err) {
      if (err instanceof ConnectFlowError) {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
      throw err
    }
  } catch (err) {
    return toErrorResponse(err)
  }
}
