/**
 * Meta WhatsApp Cloud API helpers.
 *
 * Every function takes a single options object (named parameters) instead
 * of positional arguments. This was a deliberate choice after the same
 * swapped-args bug was found four times in a row with the positional form
 * (e.g. `(accessToken, phoneNumberId)` vs `(phoneNumberId, accessToken)`).
 * With named params, a typo surfaces immediately as a TypeScript error
 * instead of a runtime rejection from Meta.
 */

const META_API_VERSION = 'v21.0'
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`

export interface MetaSendResult {
  messageId: string
}

export interface MetaPhoneInfo {
  id: string
  display_phone_number: string
  verified_name?: string
  quality_rating?: string
}

interface MetaErrorResponse {
  error?: {
    message?: string
    code?: number
    type?: string
    error_subcode?: number
    // Meta puts the actionable reason here for template rejects — the
    // top-level `message` is usually just "(#100) Invalid parameter".
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
      // Meta's top-level `message` (e.g. "(#100) Invalid parameter") is
      // rarely actionable — the specific reason lives in error_user_title
      // / error_user_msg / error_data.details. Surface all of them so a
      // rejected template says WHAT is wrong (which field, which rule).
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

// ============================================================
// Onboarding request logging
// ============================================================
//
// Embedded Signup → /register is the hardest part of this integration
// to debug: a failure surfaces days later as a "Pending" phone number
// in Meta Business Manager with no local trace of WHY. To make future
// debugging straightforward, every onboarding-related Meta request and
// response flows through `metaFetch`, which logs method, URL, request
// body, status, latency, and response body — with all secrets
// (bearer tokens, access_token / client_secret / code query params and
// body fields, and the 2FA pin) redacted.

/** Mask a secret to a recognisable-but-useless stub for logs. */
function redactSecret(value: string): string {
  if (!value) return value
  return value.length <= 8 ? '***' : `${value.slice(0, 4)}…${value.slice(-2)}`
}

const SECRET_KEYS = ['access_token', 'client_secret', 'code', 'pin']

/** Redact secret query-string params in a URL for logging. */
function redactUrl(url: string): string {
  return url.replace(
    /(access_token|client_secret|code)=([^&]+)/gi,
    (_m, key, val) => `${key}=${redactSecret(decodeURIComponent(val))}`,
  )
}

/**
 * Redact secret fields out of a JSON request/response body for logging.
 * Falls back to a truncated raw string when the body isn't JSON.
 */
function redactBodyForLog(body: unknown): unknown {
  if (body == null) return undefined
  const text = typeof body === 'string' ? body : undefined
  if (text === undefined) return '[non-string body]'
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    for (const key of SECRET_KEYS) {
      if (typeof parsed[key] === 'string') {
        parsed[key] = redactSecret(parsed[key] as string)
      }
    }
    return parsed
  } catch {
    const max = 500
    return text.length > max ? `${text.slice(0, max)}…[${text.length} chars]` : text
  }
}

interface MetaFetchContext {
  /** Onboarding step label, e.g. 'exchangeEmbeddedSignupCode'. */
  op: string
}

/**
 * fetch() wrapper that logs the request and response for onboarding
 * calls with all secrets redacted. Returns the raw Response untouched,
 * so callers keep full control over status handling (the body is read
 * from a clone for logging and is NOT consumed for the caller).
 */
async function metaFetch(
  url: string,
  init: RequestInit | undefined,
  ctx: MetaFetchContext,
): Promise<Response> {
  const started = Date.now()
  const method = init?.method ?? 'GET'
  console.info(
    `[meta:${ctx.op}] → ${method} ${redactUrl(url)}`,
    init?.body !== undefined ? { body: redactBodyForLog(init.body) } : '',
  )
  let response: Response
  try {
    response = await fetch(url, init)
  } catch (err) {
    console.error(
      `[meta:${ctx.op}] ✗ network error after ${Date.now() - started}ms:`,
      err instanceof Error ? err.message : err,
    )
    throw err
  }
  let bodyText = ''
  try {
    bodyText = await response.clone().text()
  } catch {
    bodyText = '[unreadable body]'
  }
  const line = `[meta:${ctx.op}] ← ${response.status} in ${Date.now() - started}ms`
  const logged = redactBodyForLog(bodyText)
  if (response.ok) console.info(line, logged)
  else console.error(line, logged)
  return response
}

// ============================================================
// Phone number / account
// ============================================================

export interface PhoneHealth {
  /** GREEN | YELLOW | RED | UNKNOWN — Meta's rolling quality signal. */
  qualityRating: string | null
  /** TIER_50 | TIER_250 | TIER_1K | TIER_10K | TIER_100K | TIER_UNLIMITED. */
  messagingLimitTier: string | null
}

/**
 * Read the number's health signals: quality rating + messaging limit tier.
 *
 * Deliberately SEPARATE from verifyPhoneNumber() even though both hit the
 * phone-number node. verifyPhoneNumber guards the config save/verify path;
 * if Meta ever rejected `messaging_limit_tier` as a field there, connecting
 * WhatsApp at all would break. Keeping this isolated means a bad field only
 * costs us the header badges, not onboarding.
 *
 * Callers treat any failure as "unknown" rather than an error.
 */
export async function getPhoneHealth(args: {
  phoneNumberId: string
  accessToken: string
}): Promise<PhoneHealth> {
  const { phoneNumberId, accessToken } = args
  const url = `${META_API_BASE}/${phoneNumberId}?fields=quality_rating,messaging_limit_tier`
  const response = await metaFetch(
    url,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    { op: 'getPhoneHealth' },
  )
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = (await response.json()) as {
    quality_rating?: string
    messaging_limit_tier?: string
  }
  return {
    qualityRating: data.quality_rating ?? null,
    messagingLimitTier: data.messaging_limit_tier ?? null,
  }
}

export interface VerifyPhoneNumberArgs {
  phoneNumberId: string
  accessToken: string
}

/**
 * Verify a Meta phone number ID by fetching its public metadata
 * (display_phone_number, verified_name, quality_rating).
 */
export async function verifyPhoneNumber(
  args: VerifyPhoneNumberArgs
): Promise<MetaPhoneInfo> {
  const { phoneNumberId, accessToken } = args
  const url = `${META_API_BASE}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`
  const response = await metaFetch(
    url,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    { op: 'verifyPhoneNumber' },
  )
  if (!response.ok) {
    // (#100) "nonexisting field (display_phone_number)" means the ID
    // isn't a phone-number node at all — the user almost always pasted
    // the WABA ID (or the literal +number) into the Phone Number ID
    // field. Meta's raw message is cryptic, so translate it.
    let raw = ''
    try {
      const data = (await response.clone().json()) as MetaErrorResponse
      raw = data.error?.message ?? ''
    } catch {
      /* fall through to generic handling */
    }
    if (/nonexisting field \(display_phone_number\)/i.test(raw)) {
      throw new Error(
        'That Phone Number ID is not a WhatsApp phone number. You likely entered the WhatsApp Business Account (WABA) ID or the phone number itself — copy the numeric "Phone number ID" from Meta → WhatsApp → API Setup instead.',
      )
    }
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  return response.json()
}

// ============================================================
// Business profile (public "business details" shown in-chat)
// ============================================================
//
// The WhatsApp Business Profile is the card a customer sees when they
// tap the business name in a chat: photo, an "about" line, a longer
// description, address, email, websites, and an industry vertical. All
// of it is read/written on the PHONE NUMBER node via the
// `whatsapp_business_profile` edge — NOT the WABA.
//
// The profile photo is set by first uploading the image through the
// app-scoped Resumable Upload API (`uploadResumableMedia` below) to get
// a handle, then passing that handle as `profile_picture_handle` on the
// update. Reads return a short-lived `profile_picture_url` instead.

/** Industry verticals Meta accepts for `whatsapp_business_profile.vertical`. */
export const BUSINESS_VERTICALS = [
  'UNDEFINED',
  'OTHER',
  'AUTO',
  'BEAUTY',
  'APPAREL',
  'EDU',
  'ENTERTAIN',
  'EVENT_PLAN',
  'FINANCE',
  'GROCERY',
  'GOVT',
  'HOTEL',
  'HEALTH',
  'NONPROFIT',
  'PROF_SERVICES',
  'RETAIL',
  'TRAVEL',
  'RESTAURANT',
  'NOT_A_BIZ',
] as const

export type BusinessVertical = (typeof BUSINESS_VERTICALS)[number]

export interface WhatsAppBusinessProfile {
  about?: string
  address?: string
  description?: string
  email?: string
  /** Short-lived Meta CDN URL — only present on reads, never written. */
  profile_picture_url?: string
  vertical?: string
  websites?: string[]
}

export interface GetBusinessProfileArgs {
  phoneNumberId: string
  accessToken: string
}

/**
 * Fetch the current WhatsApp business profile for a phone number.
 * Meta wraps the single profile object in a `{ data: [ … ] }` array;
 * this unwraps it (or returns `{}` when the profile is empty).
 */
export async function getBusinessProfile(
  args: GetBusinessProfileArgs,
): Promise<WhatsAppBusinessProfile> {
  const { phoneNumberId, accessToken } = args
  const fields =
    'about,address,description,email,profile_picture_url,vertical,websites'
  const url = `${META_API_BASE}/${phoneNumberId}/whatsapp_business_profile?fields=${fields}`
  const response = await metaFetch(
    url,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    { op: 'getBusinessProfile' },
  )
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = (await response.json()) as { data?: WhatsAppBusinessProfile[] }
  return data.data?.[0] ?? {}
}

export interface UpdateBusinessProfileArgs {
  phoneNumberId: string
  accessToken: string
  /**
   * Only the provided keys are sent to Meta (which patches, not
   * replaces). `profilePictureHandle` comes from `uploadResumableMedia`
   * and sets the photo; omit it to leave the current photo untouched.
   */
  profile: {
    about?: string
    address?: string
    description?: string
    email?: string
    vertical?: string
    websites?: string[]
    profilePictureHandle?: string
  }
}

/**
 * Update the WhatsApp business profile. Meta patches only the fields
 * present in the body, so callers can send a partial object (e.g. just
 * a photo handle, or just the text fields).
 */
export async function updateBusinessProfile(
  args: UpdateBusinessProfileArgs,
): Promise<void> {
  const { phoneNumberId, accessToken, profile } = args
  const body: Record<string, unknown> = { messaging_product: 'whatsapp' }
  if (profile.about !== undefined) body.about = profile.about
  if (profile.address !== undefined) body.address = profile.address
  if (profile.description !== undefined) body.description = profile.description
  if (profile.email !== undefined) body.email = profile.email
  if (profile.vertical !== undefined) body.vertical = profile.vertical
  if (profile.websites !== undefined) body.websites = profile.websites
  if (profile.profilePictureHandle !== undefined) {
    body.profile_picture_handle = profile.profilePictureHandle
  }
  const url = `${META_API_BASE}/${phoneNumberId}/whatsapp_business_profile`
  const response = await metaFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    },
    { op: 'updateBusinessProfile' },
  )
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
}

// ============================================================
// Commerce — catalog + product management
// ============================================================
//
// A WhatsApp Business Account can have ONE product catalog connected to
// it (created/owned in Meta Commerce Manager). Three different nodes are
// involved, each needing a different permission:
//
//   - `GET /{waba-id}/product_catalogs`  → the connected catalog's id +
//     name. Uses whatsapp_business_management (which the Embedded Signup
//     token already carries).
//   - `GET|POST /{phone-number-id}/whatsapp_commerce_settings` → whether
//     the catalog is shown in-chat and whether the cart is enabled.
//     Also whatsapp_business_management.
//   - `GET|POST /{catalog-id}/products`, `DELETE /{product-id}` → the
//     products themselves. These need the `catalog_management`
//     permission, which a WhatsApp-only token often does NOT have — the
//     callers treat a permission failure here as a soft, explained state
//     rather than a hard error.

export interface ProductCatalogSummary {
  id: string
  name?: string
  product_count?: number
}

export interface CommerceSettings {
  is_cart_enabled?: boolean
  is_catalog_visible?: boolean
}

export interface CatalogProduct {
  id: string
  retailer_id?: string
  name?: string
  description?: string
  /** Meta returns this pre-formatted on read (e.g. "$9.99"). */
  price?: string
  currency?: string
  availability?: string
  image_url?: string
  url?: string
}

/**
 * List the product catalog(s) connected to a WABA. In practice a WABA
 * has at most one, but Meta returns an array.
 */
export async function getConnectedCatalogs(args: {
  wabaId: string
  accessToken: string
}): Promise<ProductCatalogSummary[]> {
  const { wabaId, accessToken } = args
  const url = `${META_API_BASE}/${wabaId}/product_catalogs?fields=id,name,product_count`
  const response = await metaFetch(
    url,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    { op: 'getConnectedCatalogs' },
  )
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = (await response.json()) as { data?: ProductCatalogSummary[] }
  return data.data ?? []
}

/**
 * Read the phone number's WhatsApp commerce settings (cart on/off,
 * catalog visible in chat). Returns null when Meta has no settings row
 * for the number yet.
 */
export async function getCommerceSettings(args: {
  phoneNumberId: string
  accessToken: string
}): Promise<CommerceSettings | null> {
  const { phoneNumberId, accessToken } = args
  const url = `${META_API_BASE}/${phoneNumberId}/whatsapp_commerce_settings`
  const response = await metaFetch(
    url,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    { op: 'getCommerceSettings' },
  )
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = (await response.json()) as { data?: CommerceSettings[] }
  return data.data?.[0] ?? null
}

/**
 * Update the phone number's commerce settings. Meta takes these as
 * query params (not a JSON body); only the provided flags are changed.
 */
export async function updateCommerceSettings(args: {
  phoneNumberId: string
  accessToken: string
  isCartEnabled?: boolean
  isCatalogVisible?: boolean
}): Promise<void> {
  const { phoneNumberId, accessToken, isCartEnabled, isCatalogVisible } = args
  const params = new URLSearchParams()
  if (isCartEnabled !== undefined) params.set('is_cart_enabled', String(isCartEnabled))
  if (isCatalogVisible !== undefined) {
    params.set('is_catalog_visible', String(isCatalogVisible))
  }
  const url = `${META_API_BASE}/${phoneNumberId}/whatsapp_commerce_settings?${params.toString()}`
  const response = await metaFetch(
    url,
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } },
    { op: 'updateCommerceSettings' },
  )
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
}

export interface GetCatalogProductsResult {
  products: CatalogProduct[]
  /** Opaque cursor for the next page, or null when there are no more. */
  nextAfter: string | null
}

/**
 * List products in a catalog (paginated). Needs `catalog_management`.
 */
export async function getCatalogProducts(args: {
  catalogId: string
  accessToken: string
  after?: string
  limit?: number
}): Promise<GetCatalogProductsResult> {
  const { catalogId, accessToken, after, limit = 30 } = args
  const params = new URLSearchParams({
    fields:
      'id,retailer_id,name,description,price,currency,availability,image_url,url',
    limit: String(limit),
  })
  if (after) params.set('after', after)
  const url = `${META_API_BASE}/${catalogId}/products?${params.toString()}`
  const response = await metaFetch(
    url,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    { op: 'getCatalogProducts' },
  )
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = (await response.json()) as {
    data?: CatalogProduct[]
    paging?: { cursors?: { after?: string }; next?: string }
  }
  return {
    products: data.data ?? [],
    // Only expose the cursor when Meta says there's a next page.
    nextAfter: data.paging?.next ? data.paging?.cursors?.after ?? null : null,
  }
}

export interface CreateCatalogProductArgs {
  catalogId: string
  accessToken: string
  product: {
    /** Your SKU — unique within the catalog. */
    retailerId: string
    name: string
    description?: string
    /** Integer in the currency's minor unit (e.g. cents). 999 = 9.99. */
    priceMinorUnits: number
    currency: string
    availability: 'in stock' | 'out of stock'
    /** Publicly reachable image URL — Meta fetches it. */
    imageUrl: string
    url?: string
  }
}

/**
 * Create a product in a catalog. Needs `catalog_management`.
 * Returns Meta's assigned product id.
 */
export async function createCatalogProduct(
  args: CreateCatalogProductArgs,
): Promise<{ id: string }> {
  const { catalogId, accessToken, product } = args
  const body: Record<string, unknown> = {
    retailer_id: product.retailerId,
    name: product.name,
    price: product.priceMinorUnits,
    currency: product.currency,
    availability: product.availability,
    image_url: product.imageUrl,
  }
  if (product.description) body.description = product.description
  if (product.url) body.url = product.url
  const url = `${META_API_BASE}/${catalogId}/products`
  const response = await metaFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    },
    { op: 'createCatalogProduct' },
  )
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json()
  if (!data?.id) {
    throw new Error('Meta accepted the product but returned no id.')
  }
  return { id: String(data.id) }
}

/**
 * Delete a product by its Meta product id. Needs `catalog_management`.
 * A 404 is treated as already-gone (no-op).
 */
export async function deleteCatalogProduct(args: {
  productId: string
  accessToken: string
}): Promise<void> {
  const { productId, accessToken } = args
  const response = await metaFetch(
    `${META_API_BASE}/${productId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
    { op: 'deleteCatalogProduct' },
  )
  if (response.status === 404) return
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
}

// ============================================================
// Cloud API registration (subscription for inbound webhooks)
// ============================================================
//
// Saving a phone_number_id + access_token to whatsapp_config is NOT
// enough to receive inbound events from Meta. Two extra calls are
// required:
//
//   POST /{phone_number_id}/register
//     Subscribes the number for THIS app's webhook. Requires a
//     6-digit 2FA PIN the user previously set in Meta WhatsApp
//     Manager → Two-step verification. Without /register, inbound
//     events are routed to whichever app last claimed the number
//     (often the one that did Embedded Signup) — so a second user
//     adding a second number under the same WABA silently loses
//     every inbound message.
//
//   POST /{waba_id}/subscribed_apps
//     Subscribes the WABA itself to this app. Required exactly
//     once per WABA, but idempotent so calling on every save is
//     safe and cheap.
//
// Both calls are no-ops when already done — Meta returns success +
// the helpers below treat that as success.

export interface RegisterPhoneNumberArgs {
  phoneNumberId: string
  accessToken: string
  /**
   * 6-digit PIN the user set in Meta WhatsApp Manager →
   * Two-step verification. If 2FA is not enabled on the number,
   * Meta rejects /register with a clear error and the user is
   * pointed at the right setting in the UI.
   */
  pin: string
}

export interface RegisterPhoneNumberResult {
  success: boolean
  /**
   * True when Meta indicated the number was already registered to
   * THIS app — same outcome as a fresh registration from the
   * caller's POV, surfaced separately for logging clarity.
   */
  alreadyRegistered: boolean
}

/**
 * Register a phone number for inbound webhook events.
 *
 * Errors that should be surfaced verbatim to the user:
 *   * Missing / wrong PIN  → "Two-step verification PIN required..."
 *   * No 2FA enabled       → "Two-factor authentication is not on..."
 *   * Number on other app  → "Number is registered to another app..."
 */
export async function registerPhoneNumber(
  args: RegisterPhoneNumberArgs
): Promise<RegisterPhoneNumberResult> {
  const { phoneNumberId, accessToken, pin } = args
  const url = `${META_API_BASE}/${phoneNumberId}/register`
  const response = await metaFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
    },
    { op: 'registerPhoneNumber' },
  )

  if (response.ok) {
    return { success: true, alreadyRegistered: false }
  }

  // Meta returns an error envelope with a code. Code 133005 + the
  // text "already registered" appears when the number is already
  // subscribed to this app — that's success from the caller's
  // perspective, surface it as such.
  let data: { error?: { message?: string; code?: number; error_subcode?: number } } = {}
  try {
    data = await response.json()
  } catch {
    /* keep empty */
  }
  const message = data.error?.message ?? `Meta API error: ${response.status}`
  if (/already.*registered/i.test(message)) {
    return { success: true, alreadyRegistered: true }
  }
  throw new Error(message)
}

export interface SubscribeWabaToAppArgs {
  wabaId: string
  accessToken: string
}

/**
 * Subscribe the WABA to this Meta app's webhook. Idempotent — Meta
 * returns success even when the subscription already exists.
 */
export async function subscribeWabaToApp(
  args: SubscribeWabaToAppArgs
): Promise<void> {
  const { wabaId, accessToken } = args
  const url = `${META_API_BASE}/${wabaId}/subscribed_apps`
  const response = await metaFetch(
    url,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    { op: 'subscribeWabaToApp' },
  )
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
}

export interface GetSubscribedAppsArgs {
  wabaId: string
  accessToken: string
}

export interface SubscribedApp {
  whatsapp_business_api_data?: {
    id?: string
    name?: string
    link?: string
  }
}

/**
 * Diagnostic — fetch the list of apps currently subscribed to this
 * WABA. The UI uses this to confirm OUR app is in the list when
 * the user clicks Verify Registration.
 */
export async function getSubscribedApps(
  args: GetSubscribedAppsArgs
): Promise<SubscribedApp[]> {
  const { wabaId, accessToken } = args
  const url = `${META_API_BASE}/${wabaId}/subscribed_apps`
  const response = await metaFetch(
    url,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    { op: 'getSubscribedApps' },
  )
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = (await response.json()) as { data?: SubscribedApp[] }
  return data.data ?? []
}

// ============================================================
// Embedded Signup onboarding
// ============================================================
//
// The Embedded Signup flow (Facebook JS SDK → FB.login with an ES
// configuration) hands the browser a short-lived authorization `code`
// plus a `sessionInfo` payload carrying the new WABA id and phone
// number id. The server exchanges that code for a long-lived business
// integration system-user access token, then runs the same
// subscribe + register steps the manual path uses.
//
// See: https://developers.facebook.com/docs/whatsapp/embedded-signup

export interface ExchangeEmbeddedSignupCodeArgs {
  /** Authorization code returned by FB.login's authResponse. */
  code: string
  /** Meta App id (env META_APP_ID). */
  appId: string
  /** Meta App secret (env META_APP_SECRET). */
  appSecret: string
}

export interface ExchangeEmbeddedSignupCodeResult {
  accessToken: string
  tokenType?: string
  /** Seconds until expiry. Embedded Signup business tokens are long-lived. */
  expiresIn?: number
}

/**
 * Exchange an Embedded Signup authorization code for a business
 * integration system-user access token.
 *
 * Note: unlike the classic OAuth web flow, Embedded Signup's code
 * exchange does NOT take a `redirect_uri`. Passing one yields Meta's
 * "Invalid application ID" / redirect-mismatch errors.
 */
export async function exchangeEmbeddedSignupCode(
  args: ExchangeEmbeddedSignupCodeArgs,
): Promise<ExchangeEmbeddedSignupCodeResult> {
  const { code, appId, appSecret } = args
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
  })
  const url = `${META_API_BASE}/oauth/access_token?${params.toString()}`
  const response = await metaFetch(url, undefined, {
    op: 'exchangeEmbeddedSignupCode',
  })
  if (!response.ok) {
    await throwMetaError(response, `Code exchange failed: ${response.status}`)
  }
  const data = (await response.json()) as {
    access_token?: string
    token_type?: string
    expires_in?: number
  }
  if (!data.access_token) {
    throw new Error('Code exchange succeeded but Meta returned no access_token.')
  }
  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
  }
}

export interface WabaInfo {
  id: string
  name?: string
  currency?: string
  timezone_id?: string
  account_review_status?: string
}

/**
 * Retrieve metadata for a WhatsApp Business Account — used after code
 * exchange to confirm the token can actually see the WABA the browser
 * reported, before we persist anything.
 */
export async function getWabaInfo(args: {
  wabaId: string
  accessToken: string
}): Promise<WabaInfo> {
  const { wabaId, accessToken } = args
  const url = `${META_API_BASE}/${wabaId}?fields=id,name,currency,timezone_id,account_review_status`
  const response = await metaFetch(
    url,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    { op: 'getWabaInfo' },
  )
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  return response.json()
}

export interface WabaPhoneNumber {
  id: string
  display_phone_number: string
  verified_name?: string
  quality_rating?: string
  /** e.g. "PENDING", "CONNECTED", "FLAGGED" — Cloud API registration state. */
  status?: string
  /** e.g. "NOT_VERIFIED", "VERIFIED". */
  code_verification_status?: string
  /** e.g. "CLOUD_API", "ON_PREMISE". */
  platform_type?: string
}

/**
 * List the phone numbers under a WABA. Used to resolve / confirm the
 * Phone Number ID when Embedded Signup's sessionInfo didn't carry one,
 * and to read each number's current registration `status`.
 */
export async function getWabaPhoneNumbers(args: {
  wabaId: string
  accessToken: string
}): Promise<WabaPhoneNumber[]> {
  const { wabaId, accessToken } = args
  const url = `${META_API_BASE}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,status,code_verification_status,platform_type`
  const response = await metaFetch(
    url,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    { op: 'getWabaPhoneNumbers' },
  )
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = (await response.json()) as { data?: WabaPhoneNumber[] }
  return data.data ?? []
}

// ============================================================
// Sending
// ============================================================

export interface SendTextMessageArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  text: string
  /** Meta's message_id of the message being replied to. Adds a `context` field
   *  so WhatsApp renders the new message as a reply with a quote preview. */
  contextMessageId?: string
}

/**
 * Send a free-form WhatsApp text message.
 * Only works inside the 24-hour customer service window.
 */
export async function sendTextMessage(
  args: SendTextMessageArgs
): Promise<MetaSendResult> {
  const { phoneNumberId, accessToken, to, text, contextMessageId } = args
  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  }
  if (contextMessageId) {
    body.context = { message_id: contextMessageId }
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json()
  return { messageId: data.messages[0].id }
}

// ============================================================
// Read receipts (blue ticks)
// ============================================================

export interface MarkMessageAsReadArgs {
  phoneNumberId: string
  accessToken: string
  /**
   * Meta wamid of the INBOUND message to mark as read. Meta marks that
   * message — and every earlier message in the same conversation — as
   * read, so the customer sees blue ticks. Pass the latest inbound id.
   */
  messageId: string
}

/**
 * Tell Meta the agent has read an inbound message, which delivers the
 * blue (read) ticks to the customer's phone. Without this call, marking
 * a conversation read locally never reaches WhatsApp.
 *
 * Best-effort by convention at the call site — a failure here must not
 * block opening a conversation.
 */
export async function markMessageAsRead(
  args: MarkMessageAsReadArgs,
): Promise<void> {
  const { phoneNumberId, accessToken, messageId } = args
  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  const response = await metaFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    },
    { op: 'markMessageAsRead' },
  )
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
}

export type MediaKind = 'image' | 'video' | 'document' | 'audio'

export interface SendMediaMessageArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  kind: MediaKind
  /** Public URL Meta fetches at send time. */
  link: string
  /** Optional caption — Meta caps at 1024 chars. Documents + images + videos accept it; audio does NOT. */
  caption?: string
  /** Document-only. Shown in the recipient's chat as the file name. Ignored for image/video/audio. */
  filename?: string
  contextMessageId?: string
}

/**
 * Send an image, video, document, or audio (voice note) via a public URL.
 *
 * Used by the Flows engine's `send_media` node and the inbox composer's
 * agent-initiated media sends. Mirrors `sendTextMessage` — single fetch,
 * throws on non-2xx, returns Meta's message id.
 *
 * Audio is special-cased: Meta rejects `caption` and `filename` on audio
 * messages, so we send `{ link }` only. WhatsApp auto-renders an
 * OGG/Opus file as a playable voice note (waveform) rather than a file
 * attachment.
 */
export async function sendMediaMessage(
  args: SendMediaMessageArgs,
): Promise<MetaSendResult> {
  const { phoneNumberId, accessToken, to, kind, link, caption, filename, contextMessageId } = args
  if (!link) throw new Error('sendMediaMessage requires a link.')
  const url = `${META_API_BASE}/${phoneNumberId}/messages`

  // Audio accepts neither caption nor filename per Meta's spec — adding
  // either yields a 400. image/video/document accept a caption; only
  // document accepts a filename.
  const media: Record<string, unknown> = { link }
  if (caption && kind !== 'audio') media.caption = caption
  if (kind === 'document' && filename) media.filename = filename

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: kind,
    [kind]: media,
  }
  if (contextMessageId) body.context = { message_id: contextMessageId }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json()
  return { messageId: data.messages[0].id }
}

import type { MessageTemplate } from '@/types'
import {
  buildSendComponents,
  type SendTimeParams,
} from './template-send-builder'

export interface SendTemplateMessageArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  templateName: string
  language?: string
  /**
   * Legacy body-only params. Kept for backward compat with callers
   * that haven't migrated to the structured `template` + `messageParams`
   * pair below. New callers should pass `template` so media headers
   * and URL buttons land on the send.
   */
  params?: string[]
  /**
   * The template row from message_templates. When provided, the helper
   * builds the full components array (header + body + buttons) via
   * buildSendComponents — that's the only way image/video/document
   * headers and URL-with-variable buttons actually reach the recipient.
   */
  template?: MessageTemplate
  /**
   * Structured per-send values. Body variables go in `body`; header
   * text variables in `headerText`; media overrides in
   * `headerMediaUrl` / `headerMediaId`; URL/COPY_CODE button values
   * in `buttonParams` keyed by index.
   */
  messageParams?: SendTimeParams
  /** Meta's message_id of the message being replied to. */
  contextMessageId?: string
}

/**
 * Send a pre-approved WhatsApp message template. Required outside
 * the 24-hour window and for any first-touch messaging.
 *
 * Caller paths:
 *   - Legacy: pass `params: string[]` (body only). Same behaviour as
 *     before this helper learned about media + buttons.
 *   - Structured: pass `template` (and optionally `messageParams`).
 *     The full components array is built from the row so media
 *     headers + URL buttons land correctly.
 */
export async function sendTemplateMessage(
  args: SendTemplateMessageArgs
): Promise<MetaSendResult> {
  const {
    phoneNumberId,
    accessToken,
    to,
    templateName,
    language = 'en_US',
    params,
    template,
    messageParams,
    contextMessageId,
  } = args
  const url = `${META_API_BASE}/${phoneNumberId}/messages`

  const templatePayload: Record<string, unknown> = {
    name: templateName,
    language: { code: language },
  }

  if (template) {
    const components = buildSendComponents(template, {
      // Legacy callers pass body values in `params`; fold them into
      // `messageParams.body` so the new path covers them too.
      body: messageParams?.body ?? params,
      headerText: messageParams?.headerText,
      headerMediaUrl: messageParams?.headerMediaUrl,
      headerMediaId: messageParams?.headerMediaId,
      buttonParams: messageParams?.buttonParams,
    })
    if (components.length > 0) {
      templatePayload.components = components
    }
  } else if (params && params.length > 0) {
    // Legacy body-only path — no template row available.
    templatePayload.components = [
      {
        type: 'body',
        parameters: params.map((p) => ({ type: 'text', text: String(p) })),
      },
    ]
  }

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: templatePayload,
  }
  if (contextMessageId) {
    body.context = { message_id: contextMessageId }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json()
  return { messageId: data.messages[0].id }
}

// ============================================================
// Resumable Upload (media handles for template headers)
// ============================================================
//
// Creating a message template with a media HEADER (image/video/
// document) requires an `example.header_handle` — Meta does NOT accept
// a plain public URL at creation time. The handle comes from the
// two-step Resumable Upload API, which is keyed on the Meta APP id (not
// the phone number / WABA):
//
//   1. POST /{app_id}/uploads?file_name&file_length&file_type&access_token
//        → { id: "upload:<session>" }
//   2. POST /{id}  (Authorization: OAuth <token>, file_offset: 0, raw bytes)
//        → { h: "<handle>" }
//
// See https://developers.facebook.com/docs/graph-api/guides/upload

export interface UploadResumableMediaArgs {
  /** Meta App id (env META_APP_ID) — resumable upload is app-scoped. */
  appId: string
  accessToken: string
  fileName: string
  mimeType: string
  bytes: Uint8Array
}

/**
 * Upload a file via the Resumable Upload API and return the media
 * handle to use as `example.header_handle` when creating/editing a
 * template with a media header.
 */
export async function uploadResumableMedia(
  args: UploadResumableMediaArgs,
): Promise<{ handle: string }> {
  const { appId, accessToken, fileName, mimeType, bytes } = args

  // Step 1 — open an upload session.
  const startParams = new URLSearchParams({
    file_name: fileName,
    file_length: String(bytes.byteLength),
    file_type: mimeType,
    access_token: accessToken,
  })
  const startRes = await fetch(
    `${META_API_BASE}/${appId}/uploads?${startParams.toString()}`,
    { method: 'POST' },
  )
  if (!startRes.ok) {
    await throwMetaError(startRes, `Resumable upload start failed: ${startRes.status}`)
  }
  const startData = (await startRes.json()) as { id?: string }
  if (!startData.id) {
    throw new Error('Resumable upload did not return a session id.')
  }

  // Step 2 — upload the bytes. Note the `OAuth` auth scheme (not Bearer)
  // and the file_offset header, both required by this endpoint.
  const uploadRes = await fetch(`${META_API_BASE}/${startData.id}`, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${accessToken}`,
      file_offset: '0',
    },
    // Uint8Array is a valid BodyInit at runtime; cast around the
    // lib.dom ArrayBufferLike-vs-ArrayBuffer generic mismatch.
    body: bytes as unknown as BodyInit,
  })
  if (!uploadRes.ok) {
    await throwMetaError(uploadRes, `Resumable upload failed: ${uploadRes.status}`)
  }
  const uploadData = (await uploadRes.json()) as { h?: string }
  if (!uploadData.h) {
    throw new Error('Resumable upload did not return a file handle.')
  }
  return { handle: uploadData.h }
}

// ============================================================
// Template submission (Business Management API)
// ============================================================

import type { MetaTemplateSubmitPayload } from './template-components'

export interface SubmitMessageTemplateArgs {
  wabaId: string
  accessToken: string
  payload: MetaTemplateSubmitPayload
}

export interface SubmitMessageTemplateResult {
  id: string
  status: string
  category?: string
}

/**
 * Submit a message template to Meta for approval.
 *
 * Returns Meta's assigned template id + initial status (typically
 * PENDING). Caller persists `id` as `meta_template_id` so the
 * upcoming edit/delete flows can scope to this exact template (and
 * language variant) via `hsm_id`, rather than nuking every variant
 * with the same name.
 *
 * 429s from Meta (rate limit: 100 creates/hour/WABA) surface as a
 * regular `Error('Meta API error: 429')`. The route handler
 * distinguishes 429 and shows a more actionable toast.
 */
export async function submitMessageTemplate(
  args: SubmitMessageTemplateArgs
): Promise<SubmitMessageTemplateResult> {
  const { wabaId, accessToken, payload } = args
  const url = `${META_API_BASE}/${wabaId}/message_templates`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json()
  if (!data?.id) {
    throw new Error('Meta accepted the template but returned no id.')
  }
  return {
    id: String(data.id),
    status: typeof data.status === 'string' ? data.status : 'PENDING',
    category: typeof data.category === 'string' ? data.category : undefined,
  }
}

export interface EditMessageTemplateArgs {
  /** Meta's template id (stored locally as `meta_template_id`). */
  metaTemplateId: string
  accessToken: string
  /** Send the full components array — Meta replaces, not patches. */
  components: MetaTemplateSubmitPayload['components']
  /** Optional — only certain category transitions are allowed by Meta. */
  category?: MetaTemplateSubmitPayload['category']
}

export interface EditMessageTemplateResult {
  success: boolean
}

/**
 * Edit an existing (APPROVED or REJECTED) message template.
 *
 * Meta caps edits at 10 per 30 days (and 1 per 24h for APPROVED
 * templates). Every edit re-triggers review, so the status flips
 * back to PENDING until Meta approves the new components.
 *
 * Note: PENDING / DISABLED / IN_APPEAL templates cannot be edited
 * — the route handler enforces that before calling here.
 */
export async function editMessageTemplate(
  args: EditMessageTemplateArgs
): Promise<EditMessageTemplateResult> {
  const { metaTemplateId, accessToken, components, category } = args
  const body: Record<string, unknown> = { components }
  if (category) body.category = category
  const response = await fetch(`${META_API_BASE}/${metaTemplateId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json().catch(() => ({}))
  return { success: data?.success !== false }
}

export interface DeleteMessageTemplateArgs {
  wabaId: string
  accessToken: string
  name: string
  /**
   * Without `hsm_id`, Meta deletes EVERY language variant of the
   * template with this `name`. Pass the row's `meta_template_id`
   * to scope to a single variant.
   */
  metaTemplateId?: string
}

/**
 * Delete a message template on Meta. Pass `metaTemplateId` to scope
 * to a single language variant — otherwise Meta nukes every variant
 * sharing the same `name`.
 */
export async function deleteMessageTemplate(
  args: DeleteMessageTemplateArgs
): Promise<void> {
  const { wabaId, accessToken, name, metaTemplateId } = args
  const params = new URLSearchParams({ name })
  if (metaTemplateId) params.set('hsm_id', metaTemplateId)
  const url = `${META_API_BASE}/${wabaId}/message_templates?${params.toString()}`
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  // Treat a 404 as a no-op — the template is already gone on Meta's
  // side, and we still want the local row removed.
  if (response.status === 404) return
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
}

// ============================================================
// Reactions
// ============================================================

export interface SendReactionMessageArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  /** Meta's message_id of the message being reacted to. */
  targetMessageId: string
  /** Single emoji, or empty string to remove an existing reaction. */
  emoji: string
}

/**
 * Send a reaction (or removal) to a previously-exchanged message.
 * Empty `emoji` removes the reaction per Meta's spec.
 */
export async function sendReactionMessage(
  args: SendReactionMessageArgs
): Promise<MetaSendResult> {
  const { phoneNumberId, accessToken, to, targetMessageId, emoji } = args
  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'reaction',
      reaction: { message_id: targetMessageId, emoji },
    }),
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json()
  return { messageId: data.messages[0].id }
}

// ============================================================
// Interactive (button replies + list messages)
// ============================================================
//
// Meta's two flavours of interactive message — used by the Flows
// engine to drive scripted chatbot menus. Caller passes plain
// JS values; helpers shape the Meta payload and enforce Meta's
// limits BEFORE the network call so the failure mode is a
// developer-facing error rather than a customer-facing one.

/**
 * Meta limits for interactive messages, hard-coded so violations
 * fail at build/save time rather than as a 400 from the Meta API
 * mid-conversation. See:
 *   https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages
 *   https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-list-messages
 */
export const INTERACTIVE_LIMITS = {
  maxButtons: 3,
  buttonTitleMaxLength: 20,
  maxListSections: 10,
  maxListRowsTotal: 10,
  listRowTitleMaxLength: 24,
  listRowDescriptionMaxLength: 72,
  bodyMaxLength: 1024,
  footerMaxLength: 60,
  headerTextMaxLength: 60,
} as const

export interface InteractiveButton {
  /** Stable id sent back in the webhook when tapped (≤ 256 chars). */
  id: string
  /** Visible label (≤ 20 chars per Meta). */
  title: string
}

export interface SendInteractiveButtonsArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  /** The body text — what the customer reads above the buttons. */
  bodyText: string
  /** Optional plain-text header (≤ 60 chars). */
  headerText?: string
  /** Optional grey footer line under the buttons (≤ 60 chars). */
  footerText?: string
  /** 1–3 buttons. Validated against Meta's limits before sending. */
  buttons: InteractiveButton[]
  /** Meta's message_id of the message being replied to (quote preview). */
  contextMessageId?: string
}

/**
 * Send an interactive message with up to 3 inline reply buttons. The
 * customer taps one and Meta delivers a webhook with
 * `messages[0].interactive.button_reply.id` set to the matching button.id.
 *
 * Validation throws BEFORE the network call so misconfigured flows
 * fail at save time, not during a live conversation.
 */
export async function sendInteractiveButtons(
  args: SendInteractiveButtonsArgs
): Promise<MetaSendResult> {
  const {
    phoneNumberId, accessToken, to,
    bodyText, headerText, footerText, buttons, contextMessageId,
  } = args
  validateInteractiveBody(bodyText)
  validateInteractiveHeaderFooter(headerText, footerText)
  if (buttons.length < 1 || buttons.length > INTERACTIVE_LIMITS.maxButtons) {
    throw new Error(
      `Interactive button message requires 1-${INTERACTIVE_LIMITS.maxButtons} buttons (got ${buttons.length}).`
    )
  }
  for (const btn of buttons) {
    if (!btn.id) throw new Error('Interactive button missing id.')
    if (!btn.title) throw new Error(`Interactive button "${btn.id}" missing title.`)
    if (btn.title.length > INTERACTIVE_LIMITS.buttonTitleMaxLength) {
      throw new Error(
        `Interactive button title "${btn.title}" exceeds ${INTERACTIVE_LIMITS.buttonTitleMaxLength} chars.`
      )
    }
  }

  const interactive: Record<string, unknown> = {
    type: 'button',
    body: { text: bodyText },
    action: {
      buttons: buttons.map((b) => ({
        type: 'reply',
        reply: { id: b.id, title: b.title },
      })),
    },
  }
  if (headerText) interactive.header = { type: 'text', text: headerText }
  if (footerText) interactive.footer = { text: footerText }

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive,
  }
  if (contextMessageId) body.context = { message_id: contextMessageId }

  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json()
  return { messageId: data.messages[0].id }
}

export interface InteractiveListRow {
  /** Stable id sent back in the webhook when tapped (≤ 200 chars). */
  id: string
  /** Visible row title (≤ 24 chars per Meta). */
  title: string
  /** Optional secondary line shown under the title (≤ 72 chars). */
  description?: string
}

export interface InteractiveListSection {
  /** Optional section header shown above its rows. */
  title?: string
  rows: InteractiveListRow[]
}

export interface SendInteractiveListArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  bodyText: string
  /** Label of the tap-to-expand button on the message bubble. */
  buttonLabel: string
  headerText?: string
  footerText?: string
  /**
   * 1–10 rows TOTAL across all sections. Meta caps the *total*, not
   * per-section. Validation enforces this before send.
   */
  sections: InteractiveListSection[]
  contextMessageId?: string
}

/**
 * Send an interactive message with a tap-to-expand list of selectable
 * rows. Use when there are more options than the 3-button limit allows.
 * Webhook arrives with `messages[0].interactive.list_reply.id` set to
 * the matching row.id.
 */
export async function sendInteractiveList(
  args: SendInteractiveListArgs
): Promise<MetaSendResult> {
  const {
    phoneNumberId, accessToken, to,
    bodyText, buttonLabel, headerText, footerText, sections, contextMessageId,
  } = args
  validateInteractiveBody(bodyText)
  validateInteractiveHeaderFooter(headerText, footerText)
  if (!buttonLabel) throw new Error('Interactive list requires a buttonLabel.')
  if (buttonLabel.length > INTERACTIVE_LIMITS.buttonTitleMaxLength) {
    throw new Error(
      `Interactive list buttonLabel "${buttonLabel}" exceeds ${INTERACTIVE_LIMITS.buttonTitleMaxLength} chars.`
    )
  }
  if (sections.length < 1 || sections.length > INTERACTIVE_LIMITS.maxListSections) {
    throw new Error(
      `Interactive list requires 1-${INTERACTIVE_LIMITS.maxListSections} sections (got ${sections.length}).`
    )
  }
  const totalRows = sections.reduce((sum, s) => sum + s.rows.length, 0)
  if (totalRows < 1 || totalRows > INTERACTIVE_LIMITS.maxListRowsTotal) {
    throw new Error(
      `Interactive list requires 1-${INTERACTIVE_LIMITS.maxListRowsTotal} rows total across all sections (got ${totalRows}).`
    )
  }
  const seenIds = new Set<string>()
  for (const section of sections) {
    for (const row of section.rows) {
      if (!row.id) throw new Error('Interactive list row missing id.')
      if (seenIds.has(row.id)) {
        throw new Error(`Interactive list has duplicate row id "${row.id}".`)
      }
      seenIds.add(row.id)
      if (!row.title) throw new Error(`Interactive list row "${row.id}" missing title.`)
      if (row.title.length > INTERACTIVE_LIMITS.listRowTitleMaxLength) {
        throw new Error(
          `Interactive list row title "${row.title}" exceeds ${INTERACTIVE_LIMITS.listRowTitleMaxLength} chars.`
        )
      }
      if (
        row.description &&
        row.description.length > INTERACTIVE_LIMITS.listRowDescriptionMaxLength
      ) {
        throw new Error(
          `Interactive list row description for "${row.id}" exceeds ${INTERACTIVE_LIMITS.listRowDescriptionMaxLength} chars.`
        )
      }
    }
  }

  const interactive: Record<string, unknown> = {
    type: 'list',
    body: { text: bodyText },
    action: {
      button: buttonLabel,
      sections: sections.map((s) => ({
        ...(s.title ? { title: s.title } : {}),
        rows: s.rows.map((r) => ({
          id: r.id,
          title: r.title,
          ...(r.description ? { description: r.description } : {}),
        })),
      })),
    },
  }
  if (headerText) interactive.header = { type: 'text', text: headerText }
  if (footerText) interactive.footer = { text: footerText }

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive,
  }
  if (contextMessageId) body.context = { message_id: contextMessageId }

  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json()
  return { messageId: data.messages[0].id }
}

function validateInteractiveBody(bodyText: string): void {
  if (!bodyText) throw new Error('Interactive message requires bodyText.')
  if (bodyText.length > INTERACTIVE_LIMITS.bodyMaxLength) {
    throw new Error(
      `Interactive bodyText exceeds ${INTERACTIVE_LIMITS.bodyMaxLength} chars.`
    )
  }
}

function validateInteractiveHeaderFooter(
  headerText: string | undefined,
  footerText: string | undefined,
): void {
  if (headerText && headerText.length > INTERACTIVE_LIMITS.headerTextMaxLength) {
    throw new Error(
      `Interactive headerText exceeds ${INTERACTIVE_LIMITS.headerTextMaxLength} chars.`
    )
  }
  if (footerText && footerText.length > INTERACTIVE_LIMITS.footerMaxLength) {
    throw new Error(
      `Interactive footerText exceeds ${INTERACTIVE_LIMITS.footerMaxLength} chars.`
    )
  }
}

// ============================================================
// Media
// ============================================================

export interface GetMediaUrlArgs {
  mediaId: string
  accessToken: string
}

/**
 * Resolve a media ID to Meta's (short-lived, authenticated) CDN URL
 * plus the MIME type. Step one of the media-proxy flow.
 */
export async function getMediaUrl(
  args: GetMediaUrlArgs
): Promise<{ url: string; mimeType: string }> {
  const { mediaId, accessToken } = args
  const response = await fetch(`${META_API_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    await throwMetaError(response, `Media fetch failed: ${response.status}`)
  }
  const data = await response.json()
  if (!data.url) throw new Error('Media URL not found in Meta response')
  return { url: data.url, mimeType: data.mime_type || 'application/octet-stream' }
}

export interface DownloadMediaArgs {
  downloadUrl: string
  accessToken: string
}

/**
 * Fetch the binary bytes for a media URL obtained from getMediaUrl.
 * Step two of the media-proxy flow.
 */
export async function downloadMedia(
  args: DownloadMediaArgs
): Promise<{ buffer: Buffer; contentType: string }> {
  const { downloadUrl, accessToken } = args
  const response = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(`Media download failed: ${response.status}`)
  }
  const contentType =
    response.headers.get('content-type') || 'application/octet-stream'
  const buffer = Buffer.from(await response.arrayBuffer())
  return { buffer, contentType }
}
