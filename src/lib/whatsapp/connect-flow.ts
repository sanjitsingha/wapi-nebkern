// ============================================================
// The work behind "connect your WhatsApp number".
//
// Shared by every connect path (Embedded Signup, paste-a-token, and the
// connected page's "Finish setup") so the person connecting only ever
// supplies what Meta can't tell us: a Facebook login, or a token. The
// IDs, the webhook subscription and the two-step PIN are worked out
// here.
//
// Server-only — the Meta helpers send access tokens.
// ============================================================

import crypto from 'node:crypto'

import {
  debugAccessToken,
  getWabaInfo,
  getWabaPhoneNumbers,
  listBusinessWabas,
  registerPhoneNumber,
  type DebugTokenResult,
  type WabaInfo,
} from './meta-api'

/** A problem the person connecting can fix; its message is shown as-is. */
export class ConnectFlowError extends Error {}

/** Meta two-step PINs are six digits. */
export function generateRegistrationPin(): string {
  return String(crypto.randomInt(100000, 1000000))
}

function metaCode(err: unknown): number | undefined {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === 'number' ? code : undefined
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err ?? 'Unknown Meta API error')
}

/** /register refused the PIN: the number already has a different one. */
export function isPinMismatchError(err: unknown): boolean {
  if (metaCode(err) === 133005) return true
  const message = messageOf(err)
  return /\bpin\b/i.test(message) && /mismatch|incorrect|wrong/i.test(message)
}

/** Meta locked PIN attempts after too many guesses (133008 / 133009). */
function isPinLockout(err: unknown): boolean {
  const code = metaCode(err)
  return code === 133008 || code === 133009
}

// ------------------------------------------------------------
// Discovery: a token in, the numbers it can connect out
// ------------------------------------------------------------

export interface DiscoveredNumber {
  phoneNumberId: string
  displayPhoneNumber: string
  verifiedName: string | null
  /** Cloud API state: CONNECTED, PENDING, … */
  status: string | null
  qualityRating: string | null
  wabaId: string
  wabaName: string | null
}

export interface DiscoveryResult {
  numbers: DiscoveredNumber[]
  /**
   * Whether the token was issued for this server's Meta app. Webhooks
   * are signed with the issuing app's secret, so a token from another
   * app can send, but replies can never reach the inbox. null when the
   * token's app couldn't be read.
   */
  sameApp: boolean | null
}

/** Inspect the token, with our app's credentials first, then itself. */
async function inspectToken(
  token: string,
  appId?: string,
  appSecret?: string,
): Promise<DebugTokenResult | null> {
  const callers = appId && appSecret ? [`${appId}|${appSecret}`, token] : [token]
  for (const caller of callers) {
    try {
      return await debugAccessToken({ inputToken: token, accessToken: caller })
    } catch {
      // Try the next caller; the business listing below is the last resort.
    }
  }
  return null
}

/** Cap on how many WhatsApp Business Accounts one lookup walks. */
const MAX_WABAS = 20

export async function discoverPhoneNumbers(args: {
  accessToken: string
  appId?: string
  appSecret?: string
}): Promise<DiscoveryResult> {
  const { accessToken, appId, appSecret } = args

  const debug = await inspectToken(accessToken, appId, appSecret)
  if (debug && !debug.isValid) {
    throw new ConnectFlowError(
      "That access token isn't valid — it may have expired or been revoked. Generate a new one and paste it again.",
    )
  }

  let wabas: WabaInfo[] = (debug?.wabaIds ?? []).map((id) => ({ id }))
  if (wabas.length === 0) {
    try {
      wabas = await listBusinessWabas({ accessToken })
    } catch (err) {
      // Nothing worked. If debug_token couldn't read the token either,
      // the token itself is the problem — say so with Meta's words.
      if (!debug) {
        throw new ConnectFlowError(`Meta didn't accept that access token: ${messageOf(err)}`)
      }
    }
  }
  if (wabas.length === 0) {
    throw new ConnectFlowError(
      "This token can't see any WhatsApp Business Account. In Meta Business Settings, give the token's system user your WhatsApp account with the whatsapp_business_management and whatsapp_business_messaging permissions, then generate the token again.",
    )
  }

  const perWaba = await Promise.all(
    wabas.slice(0, MAX_WABAS).map(async (waba) => {
      const [info, phones] = await Promise.all([
        waba.name
          ? Promise.resolve(waba)
          : getWabaInfo({ wabaId: waba.id, accessToken }).catch(() => waba),
        getWabaPhoneNumbers({ wabaId: waba.id, accessToken }).catch(() => []),
      ])
      return phones.map(
        (p): DiscoveredNumber => ({
          phoneNumberId: p.id,
          displayPhoneNumber: p.display_phone_number,
          verifiedName: p.verified_name ?? null,
          status: p.status ?? null,
          qualityRating: p.quality_rating ?? null,
          wabaId: waba.id,
          wabaName: info.name ?? null,
        }),
      )
    }),
  )

  const numbers = perWaba.flat()
  if (numbers.length === 0) {
    throw new ConnectFlowError(
      'Your WhatsApp Business Account has no phone numbers yet. Add one in WhatsApp Manager, or use Continue with Facebook, which adds it for you.',
    )
  }

  return {
    numbers,
    sameApp: appId && debug?.appId ? debug.appId === appId : null,
  }
}

// ------------------------------------------------------------
// Registration: switch the number on for Cloud API
// ------------------------------------------------------------

export interface RegistrationOutcome {
  /** When /register succeeded; null otherwise. */
  registeredAt: string | null
  /** The PIN that worked. Persist it (encrypted): Meta wants it again on any re-register. */
  pin: string | null
  /** Why it failed, in words a person can act on; null on success or skip. */
  error: string | null
  /** The number already has a two-step PIN we don't know; ask for it. */
  needsPin: boolean
  /** Not registered, but nothing to fix: the number is already live on Meta. */
  skipped: boolean
}

/**
 * Register the number, choosing the PIN so nobody has to look one up:
 * the one they typed, else the one we stored last time, else a fresh
 * one — which, on a number without two-step verification, becomes its
 * PIN. Only when the number already has a PIN of its own do we need to
 * ask for it, and `needsPin` says so.
 */
export async function registerNumber(args: {
  phoneNumberId: string
  wabaId: string | null
  accessToken: string
  userPin?: string | null
  storedPin?: string | null
}): Promise<RegistrationOutcome> {
  const { phoneNumberId, wabaId, accessToken, userPin, storedPin } = args
  const pin = userPin || storedPin || generateRegistrationPin()
  const generated = !userPin && !storedPin

  try {
    await registerPhoneNumber({ phoneNumberId, accessToken, pin })
    return { registeredAt: new Date().toISOString(), pin, error: null, needsPin: false, skipped: false }
  } catch (err) {
    const failed = { registeredAt: null, pin: null, skipped: false }

    if (isPinMismatchError(err)) {
      return {
        ...failed,
        needsPin: true,
        error: userPin
          ? "That PIN doesn't match the two-step verification PIN on this number. Check it in WhatsApp Manager and try again."
          : 'This number already has a two-step verification PIN. Enter it to finish connecting.',
      }
    }
    if (isPinLockout(err)) {
      return {
        ...failed,
        needsPin: false,
        error: 'Meta paused PIN attempts on this number after too many tries. Wait a few hours, then try again.',
      }
    }

    // A number Meta already reports as live (e.g. a test number, which
    // can't be registered at all) is fine as it is. Only our own guess
    // gets this pass — a PIN the person typed failing is worth showing.
    if (generated && wabaId) {
      const status = await getWabaPhoneNumbers({ wabaId, accessToken })
        .then((list) => list.find((n) => n.id === phoneNumberId)?.status ?? null)
        .catch(() => null)
      if (status === 'CONNECTED') {
        return { registeredAt: null, pin: null, error: null, needsPin: false, skipped: true }
      }
    }

    return { ...failed, needsPin: false, error: messageOf(err) }
  }
}
