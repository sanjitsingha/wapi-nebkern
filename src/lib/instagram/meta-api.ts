/**
 * Meta Instagram Messaging API helpers.
 *
 * Mirrors the structure of `src/lib/whatsapp/meta-api.ts` (named-param
 * functions, a logging fetch wrapper with secret redaction) but is a
 * fully separate, small file rather than an import from that module —
 * `meta-api.ts` is large with many WhatsApp call sites, and duplicating
 * this ~80-line logging/error-shaping plumbing locally keeps this pass
 * from touching the WhatsApp path at all. Revisit extracting a shared
 * `lib/meta/api-client.ts` once both channels are proven stable.
 *
 * IMPORTANT — endpoint shape is not fully verified against Meta's
 * current docs: Instagram DMs can be sent via two different
 * integration paths (the older Page-token-based "Instagram Messaging
 * via Messenger Platform" vs. the newer IG-Login-based "Instagram API
 * with Instagram Login"), with different base object ids. The
 * manual-entry connect flow (Page ID + IG Business Account ID + Page
 * Access Token) targets the Page-token-based path below — confirm
 * against Meta's current Instagram Messaging API docs before relying
 * on this in production, and adjust the request builders if Meta's
 * shape has moved.
 */

const META_API_VERSION = 'v21.0'
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`

export interface InstagramSendResult {
  messageId: string
}

export interface InstagramAccountInfo {
  id: string
  username?: string
  name?: string
}

interface MetaErrorResponse {
  error?: {
    message?: string
    code?: number
    type?: string
    error_subcode?: number
    error_user_title?: string
    error_user_msg?: string
    error_data?: { details?: string } | null
  }
}

async function throwMetaError(response: Response, fallback: string): Promise<never> {
  let message = fallback
  try {
    const data = (await response.json()) as MetaErrorResponse
    const err = data.error
    if (err) {
      const seen = new Set<string>()
      const parts = [
        err.message,
        err.error_user_title,
        err.error_user_msg,
        err.error_data?.details,
      ].filter((s): s is string => {
        if (!s || !s.trim() || seen.has(s)) return false
        seen.add(s)
        return true
      })
      if (parts.length > 0) message = parts.join(' — ')
      if (err.error_subcode) message += ` [subcode ${err.error_subcode}]`
    }
  } catch {
    // response body wasn't JSON — keep the fallback
  }
  throw new Error(message)
}

/** Mask a secret to a recognisable-but-useless stub for logs. */
function redactSecret(value: string): string {
  if (!value) return value
  return value.length <= 8 ? '***' : `${value.slice(0, 4)}…${value.slice(-2)}`
}

function redactUrl(url: string): string {
  return url.replace(
    /(access_token)=([^&]+)/gi,
    (_m, key, val) => `${key}=${redactSecret(decodeURIComponent(val))}`,
  )
}

interface MetaFetchContext {
  /** Step label, e.g. 'sendInstagramText'. */
  op: string
}

/**
 * fetch() wrapper that logs the request/response for Instagram API
 * calls with the access token redacted from the URL. Returns the raw
 * Response untouched so callers keep full control over status
 * handling.
 */
async function metaFetch(
  url: string,
  init: RequestInit | undefined,
  ctx: MetaFetchContext,
): Promise<Response> {
  const started = Date.now()
  const method = init?.method ?? 'GET'
  console.info(`[instagram:${ctx.op}] → ${method} ${redactUrl(url)}`)
  let response: Response
  try {
    response = await fetch(url, init)
  } catch (err) {
    console.error(
      `[instagram:${ctx.op}] ✗ network error after ${Date.now() - started}ms:`,
      err instanceof Error ? err.message : err,
    )
    throw err
  }
  console.info(
    `[instagram:${ctx.op}] ← ${response.status} in ${Date.now() - started}ms`,
  )
  return response
}

// ============================================================
// Account verification + webhook subscription
// ============================================================

export interface VerifyInstagramAccountArgs {
  igBusinessAccountId: string
  accessToken: string
}

/**
 * Validate a token + IG business account id pair by fetching public
 * metadata. Mirrors `verifyPhoneNumber` in the WhatsApp helpers.
 * VERIFY: exact fields available on this node and whether `username`
 * needs an additional scope beyond `instagram_basic`.
 */
export async function verifyInstagramAccount(
  args: VerifyInstagramAccountArgs,
): Promise<InstagramAccountInfo> {
  const { igBusinessAccountId, accessToken } = args
  const url = `${META_API_BASE}/${igBusinessAccountId}?fields=id,username,name&access_token=${encodeURIComponent(accessToken)}`
  const response = await metaFetch(url, undefined, { op: 'verifyInstagramAccount' })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  return response.json()
}

export interface SubscribePageToAppArgs {
  pageId: string
  accessToken: string
}

/**
 * Best-effort webhook subscription for the Page's `messages` field.
 * Mirrors `subscribeWabaToApp` — never blocks the caller's save flow
 * on failure. Registering the callback URL itself against the App's
 * webhook product is a separate, unavoidably manual step in Meta's
 * App Dashboard; this call only subscribes the Page to whatever URL
 * is already configured there.
 */
export async function subscribePageToApp(args: SubscribePageToAppArgs): Promise<void> {
  const { pageId, accessToken } = args
  const url = `${META_API_BASE}/${pageId}/subscribed_apps?subscribed_fields=messages&access_token=${encodeURIComponent(accessToken)}`
  const response = await metaFetch(
    url,
    { method: 'POST' },
    { op: 'subscribePageToApp' },
  )
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
}

// ============================================================
// Sending (text + media only — MVP scope)
// ============================================================

export interface SendInstagramTextArgs {
  igBusinessAccountId: string
  accessToken: string
  /** IGSID of the customer. */
  recipientId: string
  text: string
}

/**
 * Send a plain-text Instagram DM. VERIFY endpoint shape against
 * current Meta docs before relying on this — see file header.
 */
export async function sendInstagramText(
  args: SendInstagramTextArgs,
): Promise<InstagramSendResult> {
  const { igBusinessAccountId, accessToken, recipientId, text } = args
  const url = `${META_API_BASE}/${igBusinessAccountId}/messages`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json()
  return { messageId: String(data.message_id ?? data.id) }
}

export type InstagramMediaKind = 'image' | 'video'

export interface SendInstagramMediaArgs {
  igBusinessAccountId: string
  accessToken: string
  recipientId: string
  kind: InstagramMediaKind
  /** Public URL Meta fetches at send time. */
  link: string
}

/**
 * Send an image or video via a public URL. VERIFY endpoint/payload
 * shape against current Meta docs before relying on this — see file
 * header. No caption param: not assumed supported on Instagram DM
 * media sends without confirming against docs first.
 */
export async function sendInstagramMedia(
  args: SendInstagramMediaArgs,
): Promise<InstagramSendResult> {
  const { igBusinessAccountId, accessToken, recipientId, kind, link } = args
  const url = `${META_API_BASE}/${igBusinessAccountId}/messages`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { attachment: { type: kind, payload: { url: link } } },
    }),
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json()
  return { messageId: String(data.message_id ?? data.id) }
}
