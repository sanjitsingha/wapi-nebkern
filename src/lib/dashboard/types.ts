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

export interface MetricsBundle {
  // Range-scoped counts. `current` covers the selected window; `previous`
  // covers the immediately-preceding window of equal length, so the cards
  // can show a "vs previous period" delta.
  newConversations: MetricDelta
  newContacts: MetricDelta
  messagesSent: MetricDelta
  // Open-deals value is current pipeline state (live), not range-scoped.
  openDealsValue: number
  openDealsCount: number
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
