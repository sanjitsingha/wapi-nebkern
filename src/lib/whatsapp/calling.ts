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
 * This module only covers Layer A: reading and toggling the phone
 * number's calling setting. Actually placing/answering calls (WebRTC SDP
 * exchange) is Layer B and lives elsewhere when built.
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
