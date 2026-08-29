// Shared result shapes the dashboard components consume. Centralised
// here so each component stays thin and the page-level loader wires
// them up without type gymnastics.

export interface MetricDelta {
  current: number
  previous: number
}

/**
 * A concrete, inclusive local-day window the dashboard is scoped to.
 * `from`/`to` are both start-of-local-day dates; `to` is inclusive
 * (the query layer extends it to the end of that day).
 */
export interface DashboardDateRange {
  from: Date
  to: Date
}

/**
 * Filter criteria for scoping the dashboard to a specific team member.
 * `null` or `undefined` means account-wide aggregation.
 */
export interface DashboardMemberFilter {
  /** The profile primary key (`profiles.id`), used for deals.assigned_to */
  profileId?: string | null
  /** The auth.users UUID (`profiles.user_id`), used for conversations.assigned_agent_id, contacts.user_id, messages */
  userId?: string | null
  /** Teammate's display name */
  name?: string | null
}

export interface MetricsBundle {
  // Range-scoped counts. `current` covers the selected window; `previous`
  // covers the immediately-preceding window of equal length, so the cards
  // can show a "vs previous period" delta.
  newConversations: MetricDelta
  newContacts: MetricDelta
  messagesSent: MetricDelta
  /** Outbound messages Meta rejected or could not deliver. */
  messagesFailed: MetricDelta
  // Open-deals value is current pipeline state (live), not range-scoped.
  openDealsValue: number
  openDealsCount: number
}

/**
 * Failures in the selected range, grouped by what actually went wrong.
 *
 * A raw count answers "is something broken" and nothing else. The
 * cause is what makes it fixable — and one broken template usually
 * accounts for most of a bad day, so grouping collapses a hundred rows
 * into the two or three problems behind them.
 */
export interface FailureGroup {
  /** Meta's numeric code, when the stored message carried one. */
  code: number | null
  /** Short label — the mapped title, or Meta's own text if unmapped. */
  title: string
  /** What to do about it, when the code is one we know. */
  action: string | null
  /** Failures in this group across the range. */
  count: number
  /** How many came from a broadcast rather than a direct send. */
  broadcastCount: number
  /** Named broadcasts this group appeared in, most affected first. */
  broadcasts: { id: string; name: string; count: number }[]
  /** One contact to jump to, for a direct-message failure. */
  sampleContactId: string | null
}

export interface FailureReport {
  /** Total failed outbound messages in the range. */
  total: number
  /** Failed / (sent + failed), as a percentage. Null when nothing was
   *  sent — 0% and "no sends at all" are different things. */
  failureRate: number | null
  groups: FailureGroup[]
}

export interface ConversationsSeriesPoint {
  day: string // YYYY-MM-DD local
  incoming: number
  outgoing: number
}

export interface PipelineStageSlice {
  id: string
  name: string
  color: string
  dealCount: number
  totalValue: number
}

export interface PipelineDonutData {
  stages: PipelineStageSlice[]
  totalValue: number
}

export interface ResponseTimeBucket {
  /** 0 = Mon … 6 = Sun (Monday-first). */
  dow: number
  /** Average first-response time in minutes. Null means no samples. */
  avgMinutes: number | null
  samples: number
}

export interface ResponseTimeSummary {
  buckets: ResponseTimeBucket[]
  thisWeekAvg: number | null
  lastWeekAvg: number | null
}

export type ActivityKind =
  | 'message'
  | 'deal'
  | 'broadcast'
  | 'automation'
  | 'contact'

export interface ActivityItem {
  id: string
  kind: ActivityKind
  /** Primary line of text rendered in the feed. Pre-formatted. */
  text: string
  /** ISO timestamp the item happened at, drives relative-time + sort. */
  at: string
  /** Optional deep-link for the whole row (not all items have a target). */
  href?: string
}
