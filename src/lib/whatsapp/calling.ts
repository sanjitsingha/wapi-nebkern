/**
 * WhatsApp Business Calling API helpers (Layer A — enablement + settings).
 *
 * Kept in its own module, NOT folded into meta-api.ts, for two reasons:
 *   1. The Calling API is only available from Graph API v22.0 — meta-api.ts
 *      pins v21.0 for the whole (large, battle-tested) messaging surface,
 *      and bumping that shared constant would silently move every existing
 *      call onto a new version. So calling uses its OWN version constant
 *      here and leaves messaging alone.
 *   2. Calling is a new, still-evolving Meta surface; isolating it keeps
 *      the churn contained.
 *
 * Layer A (reading and toggling the number's calling setting) and Layer
 * B (the call-control actions that place, answer, decline and end a
 * call) both live here — they are the same Meta surface on the same API
 * version, and splitting them would mean two copies of the error shaping
 * below.
 *
 * Named-parameter object args, same convention as meta-api.ts — a typo
 * surfaces as a TypeScript error rather than a swapped-args runtime bug.
 */

// Calling API requires v22.0+; messaging (meta-api.ts) stays on v21.0.
const CALLING_API_VERSION = 'v22.0'
const CALLING_API_BASE = `https://graph.facebook.com/${CALLING_API_VERSION}`

/** Whether the call button is shown to customers in the chat.
 *  DEFAULT = shown (needed for inbound calls); DISABLE_ALL = hidden. */
export type CallIconVisibility = 'DEFAULT' | 'DISABLE_ALL'

export interface CallingSettings {
  /** True when calling is ENABLED on the number. */
  enabled: boolean
  /** Raw status string Meta returned ('ENABLED' | 'DISABLED' | absent). */
  status: string | null
  callIconVisibility: string | null
  /** The whole `calling` object, kept for forensics / fields we don't
   *  model yet (call_hours, sip, callback_permission_status, …). */
  raw: Record<string, unknown> | null
}

interface CallingArgs {
  phoneNumberId: string
  accessToken: string
}

/** Mask a token for logs. */
function redact(token: string): string {
  return token.length <= 8 ? '***' : `${token.slice(0, 4)}…${token.slice(-2)}`
}

interface MetaErrorBody {
  error?: {
    message?: string
    code?: number
    error_subcode?: number
    error_user_title?: string
    error_user_msg?: string
    type?: string
  }
}

/**
 * Turn a non-2xx calling response into a legible Error. Meta's top-level
 * `message` for calling failures is often generic ("(#100) …"); the
 * actionable reason — most importantly "this number doesn't have calling
 * enabled / isn't approved" — tends to live in error_user_title/msg.
 */
async function throwCallingError(res: Response, fallback: string): Promise<never> {
  let message = fallback
  try {
    const data = (await res.json()) as MetaErrorBody
    const err = data.error
    if (err) {
      const parts = [err.message, err.error_user_title, err.error_user_msg].filter(
        (s): s is string => typeof s === 'string' && s.trim().length > 0,
      )
      if (parts.length > 0) message = Array.from(new Set(parts)).join(' — ')
      if (err.error_subcode) message += ` [subcode ${err.error_subcode}]`
    }
  } catch {
    // non-JSON body — keep the fallback
  }
  throw new Error(message)
}

/**
 * Read the phone number's calling settings.
 *
 * GET /{phone-number-id}/settings?fields=calling
 *
 * This doubles as the "does this number even have Calling API access?"
 * probe — a number without calling approval returns an error here, which
 * the caller surfaces as "not enabled by Meta yet".
 */
export async function getCallingSettings(
  args: CallingArgs,
): Promise<CallingSettings> {
  const { phoneNumberId, accessToken } = args
  const url = `${CALLING_API_BASE}/${phoneNumberId}/settings?fields=calling`
  console.info(`[calling] → GET ${url} (token ${redact(accessToken)})`)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    await throwCallingError(res, `Meta API error reading calling settings: ${res.status}`)
  }
  const data = (await res.json()) as { calling?: Record<string, unknown> }
  const calling = data.calling ?? null
  const status =
    calling && typeof calling.status === 'string' ? (calling.status as string) : null
  const callIconVisibility =
    calling && typeof calling.call_icon_visibility === 'string'
      ? (calling.call_icon_visibility as string)
      : null
  return {
    enabled: status === 'ENABLED',
    status,
    callIconVisibility,
    raw: calling,
  }
}

interface SetCallingArgs extends CallingArgs {
  enabled: boolean
  /** Only applied when enabling; defaults to DEFAULT so the call button
   *  actually shows to customers (required for inbound calls). */
  callIconVisibility?: CallIconVisibility
}

/**
 * Enable or disable calling on the phone number.
 *
 * POST /{phone-number-id}/settings  { calling: { status, call_icon_visibility } }
 *
 * Enabling with call_icon_visibility=DEFAULT is what makes the in-chat
 * call button appear for customers, i.e. what turns on inbound calling.
 */
export async function setCallingEnabled(args: SetCallingArgs): Promise<void> {
  const { phoneNumberId, accessToken, enabled, callIconVisibility = 'DEFAULT' } = args
  const url = `${CALLING_API_BASE}/${phoneNumberId}/settings`
  const calling: Record<string, unknown> = {
    status: enabled ? 'ENABLED' : 'DISABLED',
  }
  // Only meaningful when enabling; harmless but omitted on disable.
  if (enabled) calling.call_icon_visibility = callIconVisibility

  console.info(
    `[calling] → POST ${url} (token ${redact(accessToken)})`,
    { calling },
  )
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ calling }),
  })
  if (!res.ok) {
    await throwCallingError(
      res,
      `Meta API error ${enabled ? 'enabling' : 'disabling'} calling: ${res.status}`,
    )
  }
}

// ============================================================
// Layer B — call control
// ============================================================
//
// Every verb goes to the same endpoint, POST /{phone-number-id}/calls,
// distinguished by `action`. The WebRTC media never touches this server:
// the browser is one peer and the customer's handset is the other, and
// all we relay is the SDP that lets them find each other.
//
// VERIFY AT INTEGRATION TIME against Meta's current Calling API docs —
// this surface is new and the action names, the `session` shape and the
// response envelope are the parts most likely to have moved.

// ============================================================
// Call permissions
// ============================================================
//
// A business cannot cold-call a WhatsApp user. Before a
// business-initiated call connects, the customer must have granted call
// permission, and Meta refuses the `connect` action with subcode 2593090
// ("No approved call permission found") until they have.
//
// Permission is asked for with an interactive message the customer taps
// to approve, which grants a bounded window (Meta's docs describe a
// limited number of calls over a limited period, not a standing right).
// Inbound calls need none of this — the customer calling us IS consent.
//
// VERIFY AT INTEGRATION TIME: the `call_permissions` edge shape and the
// exact interactive payload are newer than the rest of this module.

/** Meta's permission verdict for one customer. */
export interface CallPermission {
  /** True when a business-initiated call would be accepted right now. */
  allowed: boolean
  /** Raw status string, e.g. 'temporary' | 'no_permission'. */
  status: string | null
  /** When the current grant lapses, if Meta reported one. */
  expiresAt: string | null
  raw: Record<string, unknown> | null
}

/**
 * Ask Meta whether we may call this number.
 *
 * GET /{phone-number-id}/call_permissions?user_wa_id={e164}
 *
 * Fails SOFT: an error here (edge not available on this API version, a
 * number Meta has never seen) resolves to "not allowed" rather than
 * throwing. The caller uses this to decide whether to offer a permission
 * prompt, and a failed lookup should show that prompt, not an error page.
 */
export async function getCallPermission(
  args: CallingArgs & { userWaId: string },
): Promise<CallPermission> {
  const { phoneNumberId, accessToken, userWaId } = args
  const url = `${CALLING_API_BASE}/${phoneNumberId}/call_permissions?user_wa_id=${encodeURIComponent(userWaId)}`
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      console.warn(`[calling] call_permissions lookup returned ${res.status}`)
      return { allowed: false, status: null, expiresAt: null, raw: null }
    }
    const data = (await res.json()) as {
      permission?: Record<string, unknown>
      data?: Array<Record<string, unknown>>
    }
    // Meta has shipped this as both a bare `permission` object and a
    // `data[]` list; read whichever is present.
    const permission = data.permission ?? data.data?.[0] ?? null
    const status =
      permission && typeof permission.status === 'string'
        ? (permission.status as string)
        : null
    const expiresAt =
      permission && typeof permission.expiration_time === 'string'
        ? (permission.expiration_time as string)
        : null

    return {
      // Anything that isn't an explicit refusal counts as permitted —
      // Meta names the granted state differently across versions
      // ('temporary', 'approved'), but the refusal is consistently
      // 'no_permission'.
      allowed: Boolean(status) && status !== 'no_permission',
      status,
      expiresAt,
      raw: permission,
    }
  } catch (err) {
    console.warn(
      '[calling] call_permissions lookup failed:',
      err instanceof Error ? err.message : err,
    )
    return { allowed: false, status: null, expiresAt: null, raw: null }
  }
}

/**
 * Send the customer an in-chat prompt asking to allow calls.
 *
 * POST /{phone-number-id}/messages with an interactive
 * `call_permission_request`. It is an ordinary message, so the usual
 * 24-hour customer service window applies — outside it Meta rejects the
 * send, and the business has to wait for the customer to write in first.
 */
export async function requestCallPermission(
  args: CallingArgs & { to: string; bodyText?: string },
): Promise<void> {
  const { phoneNumberId, accessToken, to, bodyText } = args
  const url = `${CALLING_API_BASE}/${phoneNumberId}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'call_permission_request',
        body: {
          text:
            bodyText ??
            'Can we call you on WhatsApp about your enquiry? Tap allow and we’ll ring you shortly.',
        },
        action: { name: 'call_permission_request' },
      },
    }),
  })
  if (!res.ok) {
    await throwCallingError(res, `Meta API error requesting call permission: ${res.status}`)
  }
}

/** Meta's subcode for "this customer has not allowed calls". Checked so
 *  the UI can offer the permission prompt instead of a dead end. */
export const CALL_PERMISSION_SUBCODE = 2593090

/** True when a failed call action was refused for missing permission. */
export function isCallPermissionError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return (
    message.includes(String(CALL_PERMISSION_SUBCODE)) ||
    /call permission/i.test(message)
  )
}

export type CallAction =
  /** Place an outbound call. Carries our SDP offer. */
  | 'connect'
  /** Optional early media on an inbound call — answer the SDP without
   *  picking up, so audio is flowing by the time the agent does. */
  | 'pre_accept'
  /** Pick up an inbound call. Carries our SDP answer. */
  | 'accept'
  /** Decline an inbound call. */
  | 'reject'
  /** Hang up, from either side, at any point after connect. */
  | 'terminate'

export interface CallActionArgs extends CallingArgs {
  action: CallAction
  /** Meta's call id. Required for everything except `connect`, which is
   *  the request that creates one. */
  callId?: string
  /** E.164 recipient, `connect` only. */
  to?: string
  /** Our half of the handshake: an offer for `connect`, an answer for
   *  `pre_accept` / `accept`. Omitted for `reject` / `terminate`. */
  sdp?: string
}

export interface CallActionResult {
  /** Present on `connect` — the id every later action needs. */
  callId: string | null
  raw: Record<string, unknown>
}

/**
 * Drive one call action.
 *
 * `sdp_type` is derived from the action rather than passed in: an offer
 * belongs to `connect` and an answer to `accept`/`pre_accept`, and
 * letting a caller pair them freely only makes a wrong pairing possible.
 */
export async function callAction(args: CallActionArgs): Promise<CallActionResult> {
  const { phoneNumberId, accessToken, action, callId, to, sdp } = args

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    action,
  }
  if (callId) body.call_id = callId
  if (to) body.to = to
  if (sdp) {
    body.session = {
      sdp_type: action === 'connect' ? 'offer' : 'answer',
      sdp,
    }
  }

  const url = `${CALLING_API_BASE}/${phoneNumberId}/calls`
  console.info(
    `[calling] → POST ${url} (token ${redact(accessToken)})`,
    { action, callId: callId ?? null, hasSdp: Boolean(sdp) },
  )

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    await throwCallingError(res, `Meta API error on call ${action}: ${res.status}`)
  }

  const data = (await res.json()) as {
    calls?: Array<{ id?: unknown }>
    id?: unknown
  }
  // Meta has shipped both shapes on this endpoint across versions —
  // `{calls:[{id}]}` like the messages API, and a bare `{id}`. Read both
  // rather than betting the outbound flow on which one is current.
  const fromArray = Array.isArray(data.calls) ? data.calls[0]?.id : undefined
  const id = fromArray ?? data.id
  return {
    callId: typeof id === 'string' ? id : null,
    raw: data as Record<string, unknown>,
  }
}
