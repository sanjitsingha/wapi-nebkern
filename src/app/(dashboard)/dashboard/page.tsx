"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { subDays, startOfDay } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/currency'
import {
  MessageSquare,
  UserPlus,
  DollarSign,
  Send,
  AlertTriangle,
} from 'lucide-react'

import {
  loadActivity,
  loadConversationsSeries,
  loadFailures,
  loadMetrics,
  loadPipelineDonut,
  loadResponseTime,
} from '@/lib/dashboard/queries'
import {
  addLocalDays,
  daysInRangeInclusive,
  startOfLocalDay,
} from '@/lib/dashboard/date-utils'
import type {
  ActivityItem,
  ConversationsSeriesPoint,
  DashboardDateRange,
  DashboardMemberFilter,
  FailureReport,
  MetricsBundle,
  PipelineDonutData,
  ResponseTimeSummary,
} from '@/lib/dashboard/types'

import { MetricCard } from '@/components/dashboard/metric-card'
import { SkeletonCard } from '@/components/dashboard/skeleton'
import { ConversationsChart } from '@/components/dashboard/conversations-chart'
import { FailurePanel } from '@/components/dashboard/failure-panel'
import { PipelineDonut } from '@/components/dashboard/pipeline-donut'
import { ResponseTimeChart } from '@/components/dashboard/response-time-chart'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { DateRangeSelector } from '@/components/dashboard/date-range-selector'
import {
  resolveDuration,
  type SectionDuration,
} from '@/components/dashboard/section-duration-filter'

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

  const [failures, setFailures] = useState<FailureReport | null>(null)
  const [failuresLoading, setFailuresLoading] = useState(true)

  // Per-section duration overrides. 'inherit' follows the page range.
  const [seriesDuration, setSeriesDuration] =
    useState<SectionDuration>('inherit')
  const [failuresDuration, setFailuresDuration] =
    useState<SectionDuration>('inherit')
  const [pipelineDuration, setPipelineDuration] =
    useState<SectionDuration>('inherit')
  const [activityDuration, setActivityDuration] =
    useState<SectionDuration>('inherit')

  // Everything that depends on a date range, one loader per section so
  // each owns its own skeleton (a slow query never blocks a faster one)
  // and — since sections can now be pinned to their own duration — so
  // refetching one never drags the others back to the page range.
  const loadSeries = useCallback(
    (r: DashboardDateRange, mFilter: DashboardMemberFilter | null) => {
      const db = createClient()
      setSeriesLoading(true)
      void loadConversationsSeries(db, r, mFilter)
        .then((s) => setSeries(s))
        .catch((err) => console.error('[dashboard] series failed:', err))
        .finally(() => setSeriesLoading(false))
    },
    [],
  )

  const loadFailureReport = useCallback(
    (r: DashboardDateRange, mFilter: DashboardMemberFilter | null) => {
      const db = createClient()
      setFailuresLoading(true)
      void loadFailures(db, r, mFilter)
        .then((f) => setFailures(f))
        .catch((err) => console.error('[dashboard] failures failed:', err))
        .finally(() => setFailuresLoading(false))
    },
    [],
  )

  const loadPipeline = useCallback(
    (
      r: DashboardDateRange | null,
      mFilter: DashboardMemberFilter | null,
    ) => {
      const db = createClient()
      setPipelineLoading(true)
      void loadPipelineDonut(db, mFilter, r)
        .then((p) => setPipeline(p))
        .catch((err) => console.error('[dashboard] pipeline failed:', err))
        .finally(() => setPipelineLoading(false))
    },
    [],
  )

  const loadRangeScoped = useCallback(
    (r: DashboardDateRange, mFilter: DashboardMemberFilter | null) => {
      const db = createClient()

      setMetricsLoading(true)
      void loadMetrics(db, r, mFilter)
        .then((m) => setMetrics(m))
        .catch((err) => console.error('[dashboard] metrics failed:', err))
        .finally(() => setMetricsLoading(false))
    },
    [],
  )

  const loadRangeIndependent = useCallback(
    (mFilter: DashboardMemberFilter | null) => {
      const db = createClient()

      setResponseTimeLoading(true)
      void loadResponseTime(db, mFilter)
        .then((rt) => setResponseTime(rt))
        .catch((err) => console.error('[dashboard] response time failed:', err))
        .finally(() => setResponseTimeLoading(false))

      // Fetch up to 50 so the biggest page-size option in the feed
      // (50 rows) is already in memory — switching sizes then becomes
      // a pure client-side slice with no extra round trip.
      setActivityLoading(true)
      void loadActivity(db, 50, mFilter)
        .then((a) => setActivity(a))
        .catch((err) => console.error('[dashboard] activity failed:', err))
        .finally(() => setActivityLoading(false))
    },
    [],
  )

  useEffect(() => {
    // Initial load uses the default range and all team members. Every
    // section starts on 'inherit', so they all take the page range.
    loadRangeScoped(range, null)
    loadSeries(range, null)
    loadFailureReport(range, null)
    loadPipeline(null, null)
    loadRangeIndependent(null)
    // Mount-only: the selector onChange handles subsequent range/member
    // switches so the setState calls stay out of the
    // set-state-in-effect rule's way.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Range switch handler — kept in an event callback (not an effect) so
  // the setState calls stay clear of react-hooks/set-state-in-effect.
  //
  // Sections still on 'inherit' have to be reloaded against the new
  // range; sections the user has pinned must not be, or the override
  // they set would silently evaporate the next time the global range
  // moves.
  const handleRangeChange = useCallback(
    (r: DashboardDateRange) => {
      setRange(r)
      loadRangeScoped(r, null)
      if (seriesDuration === 'inherit') loadSeries(r, null)
      if (failuresDuration === 'inherit') loadFailureReport(r, null)
      if (pipelineDuration === 'inherit') loadPipeline(null, null)
    },
    [
      loadRangeScoped,
      loadSeries,
      loadFailureReport,
      loadPipeline,
      seriesDuration,
      failuresDuration,
      pipelineDuration,
    ],
  )

  // Per-section duration overrides. Each defaults to 'inherit', which
  // means "follow the page selector"; picking anything else pins that
  // one card and re-fetches only it.
  const handleSeriesDuration = useCallback(
    (d: SectionDuration) => {
      setSeriesDuration(d)
      loadSeries(resolveDuration(d, range), null)
    },
    [loadSeries, range],
  )

  const handleFailuresDuration = useCallback(
    (d: SectionDuration) => {
      setFailuresDuration(d)
      loadFailureReport(resolveDuration(d, range), null)
    },
    [loadFailureReport, range],
  )

  // The donut is the odd one out: undefined range means "every open
  // deal", which is what it shows by default. Only a pinned duration
  // narrows it, and then to deals CREATED in that window.
  const handlePipelineDuration = useCallback(
    (d: SectionDuration) => {
      setPipelineDuration(d)
      loadPipeline(d === 'inherit' ? null : resolveDuration(d, range), null)
    },
    [loadPipeline, range],
  )

  // Activity needs no refetch: the page already holds 50 rows so the
  // page-size control can slice client-side, and this filter rides on
  // the same data.
  const visibleActivity = useMemo(() => {
    if (activity === null) return null
    if (activityDuration === 'inherit') return activity
    const { from, to } = resolveDuration(activityDuration, range)
    const start = startOfLocalDay(from).getTime()
    const end = addLocalDays(to, 1).getTime()
    return activity.filter((item) => {
      const at = new Date(item.at).getTime()
      return at >= start && at < end
    })
  }, [activity, activityDuration, range])

  // Delta comparison copy, e.g. "vs previous 30 days".
  const rangeDayCount = daysInRangeInclusive(range.from, range.to)
  const prevPeriodSuffix = `vs previous ${rangeDayCount} days`
  // The chart's header chip has to describe the data actually plotted.
  // Once the section is pinned it no longer follows the page range, and
  // a chip still reading "Last 30 days" over a 7-day chart is a lie the
  // reader has no way to catch.
  const seriesRange = resolveDuration(seriesDuration, range)
  const seriesDayCount = daysInRangeInclusive(
    seriesRange.from,
    seriesRange.to,
  )
  const seriesRangeLabel =
    seriesDayCount === 1 ? 'Today' : `Last ${seriesDayCount} days`

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
        <div className="flex flex-wrap items-center gap-2.5">
          <DateRangeSelector
            value={range}
            onChange={handleRangeChange}
            disabled={metricsLoading || seriesLoading}
          />
        </div>
      </div>

      {/* Metric cards */}
      {/* Five cards: `lg:grid-cols-5` rather than 4, or the fifth is
          stranded alone on a second row with three empty cells. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {metricsLoading || !metrics ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
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
              tone="blue"
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
              tone="amber"
              subtitle={`${metrics.openDealsCount} open deal${metrics.openDealsCount === 1 ? '' : 's'}`}
            />
            <MetricCard
              title="Messages Sent"
              value={metrics.messagesSent.current.toLocaleString()}
              icon={Send}
              tone="violet"
              delta={{
                sign:
                  metrics.messagesSent.current - metrics.messagesSent.previous,
                label: deltaLabel(
                  metrics.messagesSent.current - metrics.messagesSent.previous,
                  prevPeriodSuffix,
                ),
              }}
            />
            {/* `invertDelta`: more failures is worse, and the default
                colouring would paint a rise green. */}
            <MetricCard
              title="Failed Deliveries"
              value={metrics.messagesFailed.current.toLocaleString()}
              icon={AlertTriangle}
              tone="red"
              invertDelta
              delta={{
                sign:
                  metrics.messagesFailed.current -
                  metrics.messagesFailed.previous,
                label: deltaLabel(
                  metrics.messagesFailed.current -
                    metrics.messagesFailed.previous,
                  prevPeriodSuffix,
                ),
              }}
            />
          </>
        )}
      </div>

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
            rangeLabel={seriesRangeLabel}
            duration={seriesDuration}
            onDurationChange={handleSeriesDuration}
          />
        </div>
        <div className="h-full lg:col-span-2">
          <PipelineDonut
            data={pipeline}
            loading={pipelineLoading}
            currency={defaultCurrency}
            duration={pipelineDuration}
            onDurationChange={handlePipelineDuration}
          />
        </div>
      </div>

      {/* Delivery problems. Above the response-time chart and the
          activity feed: those describe how the team is doing, this one
          is something to go and fix. */}
      <FailurePanel
        report={failures}
        loading={failuresLoading}
        duration={failuresDuration}
        onDurationChange={handleFailuresDuration}
      />

      {/* Response time. No duration filter — it is a fixed this-week vs
          last-week comparison by weekday, so a range has nowhere to go. */}
      <ResponseTimeChart data={responseTime} loading={responseTimeLoading} />

      {/* Activity feed */}
      <ActivityFeed
        items={visibleActivity}
        loading={activityLoading}
        duration={activityDuration}
        onDurationChange={setActivityDuration}
      />
    </div>
  )
}

// ------------------------------------------------------------

function deltaLabel(delta: number, suffix: string): string {
  if (delta === 0) return `No change ${suffix}`
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toLocaleString()} ${suffix}`
}
