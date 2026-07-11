/**
 * WhatsApp billing & usage helpers.
 *
 * IMPORTANT — there is no "wallet balance" API. Meta does NOT expose a
 * spendable wallet/credit balance through the Graph API:
 *   - Postpaid accounts have a credit line, but /{business-id}/
 *     extendedcredits returns metadata only (id, legal entity), never a
 *     remaining balance.
 *   - Prepaid wallets (India/Brazil) are visible only in WhatsApp Manager.
 *
 * What IS queryable is conversation-level COST analytics on the WABA, from
 * which we derive an "estimated spend this period" figure. That is what
 * this module reads. It needs only the WABA id + access token we already
 * store (whatsapp_business_management permission) — no business
 * verification is required to *call* it (an unverified/not-live client
 * simply returns empty data or a Meta error, which callers degrade
 * gracefully).
 *
 * Own API-version constant + named-parameter args, same convention as
 * calling.ts / meta-api.ts — a typo surfaces as a TypeScript error rather
 * than a swapped-args runtime bug.
 */

// Conversation analytics is stable on v21.0 (same as the messaging surface).
const BILLING_API_VERSION = 'v21.0'
const BILLING_API_BASE = `https://graph.facebook.com/${BILLING_API_VERSION}`

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

/** Mask a token for logs. */
function redact(token: string): string {
  return token.length <= 8 ? '***' : `${token.slice(0, 4)}…${token.slice(-2)}`
}

/**
 * Turn a non-2xx billing response into a legible Error. The actionable
 * reason for the common failures here — "this app/token can't read
 * business-level analytics" (missing whatsapp_business_management) or
 * "business not eligible" — usually lives in error_user_title/msg rather
 * than the generic top-level message.
 */
async function throwBillingError(res: Response, fallback: string): Promise<never> {
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

export interface UsageCategoryBreakdown {
  /** Meta conversation category, e.g. MARKETING / UTILITY / SERVICE / AUTHENTICATION. */
  category: string
  cost: number
  conversations: number
}

export interface ConversationUsage {
  /** Total estimated cost across the window, in `currency`. */
  totalCost: number
  /** Total billable conversations across the window. */
  totalConversations: number
  /** ISO currency code from the WABA (e.g. 'USD', 'INR'); null if Meta omitted it. */
  currency: string | null
  /** Per-category breakdown for display. */
  byCategory: UsageCategoryBreakdown[]
  /** Window echoed back (Unix seconds). */
  start: number
  end: number
}

interface ConversationUsageArgs {
  wabaId: string
  accessToken: string
  /** Window start, Unix seconds. */
  start: number
  /** Window end, Unix seconds. */
  end: number
}

interface AnalyticsDataPoint {
  start?: number
  end?: number
  cost?: number
  conversation?: number
  conversation_category?: string
}

/**
 * Read conversation COST + count analytics for a WABA over [start, end].
 *
 * GET /{waba-id}?fields=currency,conversation_analytics.start(..).end(..)
 *     .granularity(DAILY).metric_types(['COST','CONVERSATION'])
 *     .dimensions(['CONVERSATION_CATEGORY'])
 *
 * Costs are summed across daily data points and grouped by conversation
 * category. `currency` is read from the WABA node in the same call so the
 * UI can format the figure without a second request.
 */
export async function getConversationUsage(
  args: ConversationUsageArgs,
): Promise<ConversationUsage> {
  const { wabaId, accessToken, start, end } = args

  // Nested-field syntax: the analytics params live INSIDE the field call,
  // not as top-level query params.
  const analytics =
    `conversation_analytics.start(${start}).end(${end}).granularity(DAILY)` +
    `.metric_types(['COST','CONVERSATION']).dimensions(['CONVERSATION_CATEGORY'])`
  const url = `${BILLING_API_BASE}/${wabaId}?fields=currency,${analytics}`

  console.info(`[billing] → GET ${url} (token ${redact(accessToken)})`)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    await throwBillingError(res, `Meta API error reading usage analytics: ${res.status}`)
  }

  const data = (await res.json()) as {
    currency?: string
    conversation_analytics?: { data?: { data_points?: AnalyticsDataPoint[] }[] }
  }

  const currency = typeof data.currency === 'string' ? data.currency : null
  const points = data.conversation_analytics?.data?.[0]?.data_points ?? []

  let totalCost = 0
  let totalConversations = 0
  const categoryMap = new Map<string, UsageCategoryBreakdown>()

  for (const point of points) {
    const cost = typeof point.cost === 'number' ? point.cost : 0
    const conversations =
      typeof point.conversation === 'number' ? point.conversation : 0
    totalCost += cost
    totalConversations += conversations

    const category = point.conversation_category || 'UNKNOWN'
    const existing = categoryMap.get(category)
    if (existing) {
      existing.cost += cost
      existing.conversations += conversations
    } else {
      categoryMap.set(category, { category, cost, conversations })
    }
  }

  return {
    totalCost,
    totalConversations,
    currency,
    byCategory: Array.from(categoryMap.values()).sort((a, b) => b.cost - a.cost),
    start,
    end,
  }
}

// ============================================================
// Credit line (postpaid) — status only, NOT a balance
// ============================================================
//
// A WhatsApp postpaid account is billed against an "extended credit"
// line held by the Business Portfolio that OWNS the WABA. Meta exposes
// GET /{business-id}/extendedcredits, but only credit-line METADATA
// (id, legal entity) — there is no remaining-balance field. We use it
// purely to answer "is a credit line attached, and to which entity?".
//
// We don't store the business id (the manual connect form never collects
// it, and threading it through Embedded Signup is invasive), so we derive
// it on demand from the WABA via `owner_business_info`. Both calls need
// business_management on the token + access to the owning business, so
// callers treat any failure as an unknown/soft state.

export interface OwningBusiness {
  id: string
  name: string | null
}

/**
 * Resolve the Business Portfolio that owns a WABA. Returns null when Meta
 * omits owner info (e.g. token can't see the business).
 */
export async function getOwningBusiness(args: {
  wabaId: string
  accessToken: string
}): Promise<OwningBusiness | null> {
  const { wabaId, accessToken } = args
  const url = `${BILLING_API_BASE}/${wabaId}?fields=owner_business_info`
  console.info(`[billing] → GET ${url} (token ${redact(accessToken)})`)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    await throwBillingError(res, `Meta API error reading owning business: ${res.status}`)
  }
  const data = (await res.json()) as {
    owner_business_info?: { id?: string; name?: string }
  }
  const id = data.owner_business_info?.id
  if (!id) return null
  return { id, name: data.owner_business_info?.name ?? null }
}

export interface CreditLine {
  /** Meta's extended-credit id. */
  id: string
  /** The legal entity the credit line belongs to, if returned. */
  legalEntityName: string | null
}

/**
 * List the extended credit lines on a Business Portfolio.
 *
 * Only `id` and `legal_entity_name` are requested — those are the fields
 * reliably present across accounts, and (critically) there is NO balance
 * field to request. An empty array means no credit line is attached.
 */
export async function getExtendedCredits(args: {
  businessId: string
  accessToken: string
}): Promise<CreditLine[]> {
  const { businessId, accessToken } = args
  const url = `${BILLING_API_BASE}/${businessId}/extendedcredits?fields=id,legal_entity_name`
  console.info(`[billing] → GET ${url} (token ${redact(accessToken)})`)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    await throwBillingError(res, `Meta API error reading credit lines: ${res.status}`)
  }
  const data = (await res.json()) as {
    data?: { id?: string; legal_entity_name?: string }[]
  }
  return (data.data ?? [])
    .filter((c): c is { id: string; legal_entity_name?: string } => !!c.id)
    .map((c) => ({ id: c.id, legalEntityName: c.legal_entity_name ?? null }))
}
