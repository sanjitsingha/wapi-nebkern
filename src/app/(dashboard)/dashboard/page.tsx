"use client"

import { useCallback, useEffect, useState } from 'react'
import { subDays, startOfDay } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/currency'
import {
  MessageSquare,
  UserPlus,
  DollarSign,
  Send,
} from 'lucide-react'

import {
  loadActivity,
  loadConversationsSeries,
  loadMetrics,
  loadPipelineDonut,
  loadResponseTime,
} from '@/lib/dashboard/queries'
import { daysInRangeInclusive } from '@/lib/dashboard/date-utils'
import type {
  ActivityItem,
  ConversationsSeriesPoint,
  DashboardDateRange,
  MetricsBundle,
  PipelineDonutData,
  ResponseTimeSummary,
} from '@/lib/dashboard/types'

import { MetricCard } from '@/components/dashboard/metric-card'
import { SkeletonCard } from '@/components/dashboard/skeleton'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { ConversationsChart } from '@/components/dashboard/conversations-chart'
import { PipelineDonut } from '@/components/dashboard/pipeline-donut'
import { ResponseTimeChart } from '@/components/dashboard/response-time-chart'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { DateRangeSelector } from '@/components/dashboard/date-range-selector'

// Default window: the last 30 local days (inclusive of today).
function defaultRange(): DashboardDateRange {
  return { from: subDays(startOfDay(new Date()), 29), to: startOfDay(new Date()) }
}

export default function DashboardPage() {
  const { defaultCurrency } = useAuth()
  const [metrics, setMetrics] = useState<MetricsBundle | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  const [range, setRange] = useState<DashboardDateRange>(defaultRange)
  const [series, setSeries] = useState<ConversationsSeriesPoint[] | null>(null)
  const [seriesLoading, setSeriesLoading] = useState(true)

  const [pipeline, setPipeline] = useState<PipelineDonutData | null>(null)
  const [pipelineLoading, setPipelineLoading] = useState(true)

  const [responseTime, setResponseTime] = useState<ResponseTimeSummary | null>(null)
  const [responseTimeLoading, setResponseTimeLoading] = useState(true)

  const [activity, setActivity] = useState<ActivityItem[] | null>(null)
  const [activityLoading, setActivityLoading] = useState(true)

  // Load everything that depends on the selected date range: the metric
  // cards and the conversations series. Each block owns its skeleton so a
  // slow query never blocks a faster one.
  const loadRangeScoped = useCallback((r: DashboardDateRange) => {
    const db = createClient()

    setMetricsLoading(true)
    void loadMetrics(db, r)
      .then((m) => setMetrics(m))
      .catch((err) => console.error('[dashboard] metrics failed:', err))
      .finally(() => setMetricsLoading(false))

    setSeriesLoading(true)
    void loadConversationsSeries(db, r)
      .then((s) => setSeries(s))
      .catch((err) => console.error('[dashboard] series failed:', err))
      .finally(() => setSeriesLoading(false))
  }, [])

  const loadRangeIndependent = useCallback(() => {
    const db = createClient()

    void loadResponseTime(db)
      .then((rt) => setResponseTime(rt))
      .catch((err) => console.error('[dashboard] response time failed:', err))
      .finally(() => setResponseTimeLoading(false))

    void loadPipelineDonut(db)
      .then((p) => setPipeline(p))
      .catch((err) => console.error('[dashboard] pipeline failed:', err))
      .finally(() => setPipelineLoading(false))

    // Fetch up to 50 so the biggest page-size option in the feed
    // (50 rows) is already in memory — switching sizes then becomes
    // a pure client-side slice with no extra round trip.
    void loadActivity(db, 50)
      .then((a) => setActivity(a))
      .catch((err) => console.error('[dashboard] activity failed:', err))
      .finally(() => setActivityLoading(false))
  }, [])

  useEffect(() => {
    // Initial load uses the default range.
    loadRangeScoped(range)
    loadRangeIndependent()
    // Mount-only: the selector's onChange handles subsequent range
    // switches so the setState calls stay out of the
    // set-state-in-effect rule's way.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Range switch handler — kept in an event callback (not an effect) so
  // the setState calls stay clear of react-hooks/set-state-in-effect.
  const handleRangeChange = useCallback(
    (r: DashboardDateRange) => {
      setRange(r)
      loadRangeScoped(r)
    },
    [loadRangeScoped],
  )

  // Delta comparison copy, e.g. "vs previous 30 days".
  const rangeDayCount = daysInRangeInclusive(range.from, range.to)
  const prevPeriodSuffix = `vs previous ${rangeDayCount} days`
  const rangeLabel =
    rangeDayCount === 1 ? '1 day' : `${rangeDayCount} days`

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live analytics across conversations, contacts, deals, broadcasts, and automations.
          </p>
        </div>
        <DateRangeSelector
          value={range}
          onChange={handleRangeChange}
          disabled={metricsLoading || seriesLoading}
        />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricsLoading || !metrics ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              title="New Conversations"
              value={metrics.newConversations.current.toLocaleString()}
              icon={MessageSquare}
              delta={{
                sign:
                  metrics.newConversations.current - metrics.newConversations.previous,
                label: deltaLabel(
                  metrics.newConversations.current - metrics.newConversations.previous,
                  prevPeriodSuffix,
                ),
              }}
            />
            <MetricCard
              title="New Contacts"
              value={metrics.newContacts.current.toLocaleString()}
              icon={UserPlus}
              delta={{
                sign:
                  metrics.newContacts.current - metrics.newContacts.previous,
                label: deltaLabel(
                  metrics.newContacts.current - metrics.newContacts.previous,
                  prevPeriodSuffix,
                ),
              }}
            />
            <MetricCard
              title="Open Deals Value"
              value={formatCurrency(metrics.openDealsValue, defaultCurrency)}
              icon={DollarSign}
              subtitle={`${metrics.openDealsCount} open deal${metrics.openDealsCount === 1 ? '' : 's'}`}
            />
            <MetricCard
              title="Messages Sent"
              value={metrics.messagesSent.current.toLocaleString()}
              icon={Send}
              delta={{
                sign:
                  metrics.messagesSent.current - metrics.messagesSent.previous,
                label: deltaLabel(
                  metrics.messagesSent.current - metrics.messagesSent.previous,
                  prevPeriodSuffix,
                ),
              }}
            />
          </>
        )}
      </div>

      {/* Quick actions */}
      <QuickActions />

      {/* Charts row */}
      {/* items-stretch (the grid default) stretches the two columns to
          match the tallest sibling; adding h-full on each wrapper and
          on the inner panels makes both cards actually fill that
          stretched height so their rounded borders line up. Without
          this, the pipeline card rendered at its natural (shorter)
          height while the line chart drove the row height. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="h-full lg:col-span-3">
          <ConversationsChart
            data={series}
            loading={seriesLoading}
            rangeLabel={`Last ${rangeLabel}`}
          />
        </div>
        <div className="h-full lg:col-span-2">
          <PipelineDonut
            data={pipeline}
            loading={pipelineLoading}
            currency={defaultCurrency}
          />
        </div>
      </div>

      {/* Response time */}
      <ResponseTimeChart data={responseTime} loading={responseTimeLoading} />

      {/* Activity feed */}
      <ActivityFeed items={activity} loading={activityLoading} />
    </div>
  )
}

// ------------------------------------------------------------

function deltaLabel(delta: number, suffix: string): string {
  if (delta === 0) return `No change ${suffix}`
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toLocaleString()} ${suffix}`
}
