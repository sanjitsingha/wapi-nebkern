import { NextResponse } from 'next/server'

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { loadWhatsAppAccess } from '@/lib/whatsapp/server-config'
import {
  callAction,
  getCallPermission,
  isCallPermissionError,
  requestCallPermission,
  type CallAction,
} from '@/lib/whatsapp/calling'
import { normalizePhone } from '@/lib/whatsapp/phone-utils'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import {
  featureBlockedResponse,
  getAccountEntitlements,
} from '@/lib/billing/entitlements'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'

/**
 * POST /api/whatsapp/calls
 *
 * Call control for the browser softphone. One endpoint, five actions:
 *
 *   connect            { to, sdp }        place an outbound call
 *   pre_accept         { call_id, sdp }   answer media early, still ringing
 *   accept             { call_id, sdp }   pick up
 *   reject             { call_id }        decline
 *   terminate          { call_id }        hang up
 *   request_permission { to }             ask the customer to allow calls
 *
 * `request_permission` is the odd one out: it sends a message, not a call
 * action. It lives here anyway because it exists solely to unblock
 * `connect`, and a caller that hits the permission wall needs the remedy
 * on the same endpoint that refused it.
 *
 * Agent+ (any member who can work the inbox), not admin — answering the
 * phone is the job, whereas turning calling on for the whole business is
 * a setting, and that stays admin-only on /api/whatsapp/calling.
 *
 * The SDP passes straight through. Media is peer-to-peer between the
 * agent's browser and the customer's handset; this server only carries
 * the introductions, and never sees or proxies audio.
 */

const ACTIONS: CallAction[] = ['connect', 'pre_accept', 'accept', 'reject', 'terminate']

/** Not a Meta call action — see the route doc. */
const REQUEST_PERMISSION = 'request_permission'

/**
 * GET /api/whatsapp/calls?phone=<e164>
 *
 * May we call this number right now? Used as a pre-flight before the
 * browser asks for the microphone — there is no point lighting someone's
 * mic and gathering ICE candidates for a call Meta will refuse, and a
 * permission prompt is a far better answer than a denied dial.
 *
 * Never fails hard: a lookup error resolves to "not allowed", which
 * routes the user to the permission prompt rather than an error.
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await getCurrentAccount()

    const phone = new URL(request.url).searchParams.get('phone')
    if (!phone) {
      return NextResponse.json({ error: 'phone is required' }, { status: 400 })
    }

    const ent = await getAccountEntitlements(supabase, accountId)
    if (!ent.allowCalling) return featureBlockedResponse('WhatsApp Calling')

    const access = await loadWhatsAppAccess(supabase, accountId)
    if (!access.ok) {
      return NextResponse.json({ allowed: false, reason: 'not_connected' })
    }

    const permission = await getCallPermission({
      phoneNumberId: access.access.phoneNumberId,
      accessToken: access.access.accessToken,
      userWaId: normalizePhone(phone),
    })

    return NextResponse.json({
      allowed: permission.allowed,
      status: permission.status,
      expires_at: permission.expiresAt,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await getCurrentAccount()

    // Its own bucket, away from `send:` — a burst of call signalling
    // (accept then terminate in quick succession is normal) must not eat
    // an agent's message allowance.
    const limit = checkRateLimit(`calls:${userId}`, RATE_LIMITS.send)
    if (!limit.success) return rateLimitResponse(limit)

    const ent = await getAccountEntitlements(supabase, accountId)
    if (!ent.allowCalling) return featureBlockedResponse('WhatsApp Calling')

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const action = body.action as CallAction | typeof REQUEST_PERMISSION
    if (!ACTIONS.includes(action as CallAction) && action !== REQUEST_PERMISSION) {
      return NextResponse.json(
        { error: `action must be one of ${[...ACTIONS, REQUEST_PERMISSION].join(', ')}` },
        { status: 400 },
      )
    }

    const callId = typeof body.call_id === 'string' ? body.call_id : undefined
    const sdp = typeof body.sdp === 'string' ? body.sdp : undefined
    const to = typeof body.to === 'string' ? body.to : undefined

    const needsRecipient = action === 'connect' || action === REQUEST_PERMISSION
    if (needsRecipient && !to) {
      return NextResponse.json(
        { error: 'to is required for this action' },
        { status: 400 },
      )
    }
    if (!needsRecipient && !callId) {
      return NextResponse.json({ error: 'call_id is required' }, { status: 400 })
    }
    if ((action === 'connect' || action === 'accept' || action === 'pre_accept') && !sdp) {
      return NextResponse.json(
        { error: `sdp is required for ${action}` },
        { status: 400 },
      )
    }

    const access = await loadWhatsAppAccess(supabase, accountId)
    if (!access.ok) {
      return NextResponse.json(
        {
          error:
            access.reason === 'no_config'
              ? 'WhatsApp is not connected. Set it up under Settings → WhatsApp first.'
              : 'The stored WhatsApp access token could not be decrypted.',
        },
        { status: 400 },
      )
    }

    // Ownership guard on every action that names an existing call: a
    // call_id is an opaque string from Meta, and without this an agent
    // could hang up another tenant's call by guessing one.
    if (callId) {
      const { data: owned } = await supabase
        .from('call_logs')
        .select('id')
        .eq('account_id', accountId)
        .eq('wa_call_id', callId)
        .maybeSingle()
      if (!owned) {
        return NextResponse.json({ error: 'Call not found' }, { status: 404 })
      }
    }

    // Ask the customer to allow calls. Ends the request here — nothing
    // is dialled, and no call_logs row exists to write.
    if (action === REQUEST_PERMISSION) {
      try {
        await requestCallPermission({
          phoneNumberId: access.access.phoneNumberId,
          accessToken: access.access.accessToken,
          to: normalizePhone(to!),
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown Meta API error'
        return NextResponse.json(
          {
            error: `Could not send the permission request: ${message}. This is an ordinary message, so it only sends inside the 24-hour window after the customer last wrote to you.`,
          },
          { status: 400 },
        )
      }
      return NextResponse.json({ success: true, requested: true })
    }

    let result
    try {
      result = await callAction({
        phoneNumberId: access.access.phoneNumberId,
        accessToken: access.access.accessToken,
        action,
        callId,
        to: to ? normalizePhone(to) : undefined,
        sdp,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'

      // A cold call to someone who never granted permission is the
      // single most likely way `connect` fails. Flag it so the UI can
      // offer to ask, instead of showing a Meta subcode and stopping.
      if (action === 'connect' && isCallPermissionError(err)) {
        return NextResponse.json(
          {
            error:
              'This customer has not allowed calls from your business yet. Send them a permission request and they can approve it in the chat.',
            code: 'call_permission_required',
          },
          { status: 403 },
        )
      }

      return NextResponse.json({ error: `Meta rejected the call: ${message}` }, { status: 400 })
    }

    // Writes go through the service-role client so the row shape matches
    // the webhook's exactly — that route is the other writer, and two
    // writers disagreeing about a row is how call state goes wrong.
    if (action === 'connect') {
      const newCallId = result.callId
      if (!newCallId) {
        return NextResponse.json(
          { error: 'Meta accepted the call but returned no call id.' },
          { status: 502 },
        )
      }

      const contact = await resolveOutboundContact(accountId, userId, normalizePhone(to!))

      const { error } = await supabaseAdmin().from('call_logs').upsert(
        {
          account_id: accountId,
          conversation_id: contact?.conversationId ?? null,
          contact_id: contact?.contactId ?? null,
          wa_call_id: newCallId,
          direction: 'outbound',
          status: 'ringing',
          started_at: new Date().toISOString(),
          answered_by: userId,
          sdp_offer: sdp ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id,wa_call_id' },
      )
      if (error) console.error('[calls] outbound call_logs upsert failed:', error)

      return NextResponse.json({ success: true, call_id: newCallId })
    }

    if (action === 'accept' || action === 'pre_accept') {
      const { error } = await supabaseAdmin()
        .from('call_logs')
        .update({
          // pre_accept is still ringing — only a real pickup is in
          // progress, or the history would count early media as answered.
          status: action === 'accept' ? 'in_progress' : 'ringing',
          answered_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('account_id', accountId)
        .eq('wa_call_id', callId!)
      if (error) console.error('[calls] accept update failed:', error)
    }

    // reject / terminate deliberately don't finalize the row here. Meta
    // sends a `terminate` webhook for every ended call with the outcome
    // and duration, and that handler owns the final status — writing our
    // own guess first would race it and could stick.

    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * Find the contact and conversation an outbound call belongs to, so it
 * lands in the right thread and in call history under a name.
 *
 * Read-only on purpose: a call to a number nobody has ever messaged logs
 * with null ids rather than conjuring a contact. Inventing CRM records
 * from a misdialled number is worse than a call row without a name.
 */
async function resolveOutboundContact(
  accountId: string,
  userId: string,
  phone: string,
): Promise<{ contactId: string; conversationId: string | null } | null> {
  void userId
  const { data: contact } = await supabaseAdmin()
    .from('contacts')
    .select('id')
    .eq('account_id', accountId)
    .eq('phone', phone)
    .maybeSingle()
  if (!contact) return null

  const { data: conversation } = await supabaseAdmin()
    .from('conversations')
    .select('id')
    .eq('account_id', accountId)
    .eq('contact_id', contact.id)
    .eq('channel', 'whatsapp')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return { contactId: contact.id, conversationId: conversation?.id ?? null }
}
