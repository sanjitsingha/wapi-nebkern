"use client"

import { useCallback, useEffect, useState } from 'react'
import { subDays, startOfDay } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/currency'

import {
  AlertTriangle,
  IndianRupee,
  MessageSquare,
  Send,
  UserPlus,
} from 'lucide-react'

import { loadMetrics } from '@/lib/dashboard/queries'
import { daysInRangeInclusive } from '@/lib/dashboard/date-utils'
import type { DashboardDateRange, MetricsBundle } from '@/lib/dashboard/types'

import { MetricCard } from '@/components/dashboard/metric-card'
import { SkeletonCard } from '@/components/dashboard/skeleton'
import { QuickLinks } from '@/components/dashboard/quick-links'
import { TeamPresence } from '@/components/dashboard/team-presence'
import { DateRangeSelector } from '@/components/dashboard/date-range-selector'

// Default window: the last 30 local days (inclusive of today).
function defaultRange(): DashboardDateRange {
  return { from: subDays(startOfDay(new Date()), 29), to: startOfDay(new Date()) }
}

// The headline numbers and the quick links. The charts — conversations
// over time, pipeline value, first response time — belong to the
// analytics page, not here.
export default function DashboardPage() {
  const { defaultCurrency } = useAuth()
  const [metrics, setMetrics] = useState<MetricsBundle | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  const [range, setRange] = useState<DashboardDateRange>(defaultRange)

  const loadRangeMetrics = useCallback((r: DashboardDateRange) => {
    const db = createClient()
    setMetricsLoading(true)
    void loadMetrics(db, r, null)
      .then((m) => setMetrics(m))
      .catch((err) => console.error('[dashboard] metrics failed:', err))
      .finally(() => setMetricsLoading(false))
  }, [])

  useEffect(() => {
    // Mount-only: the selector onChange handles later range switches so
    // the setState calls stay out of the set-state-in-effect rule's way.
    loadRangeMetrics(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Range switch handler — kept in an event callback (not an effect) so
  // the setState calls stay clear of react-hooks/set-state-in-effect.
  const handleRangeChange = useCallback(
    (r: DashboardDateRange) => {
      setRange(r)
      loadRangeMetrics(r)
    },
    [loadRangeMetrics],
  )

  // Delta comparison copy, e.g. "vs previous 30 days".
  const rangeDayCount = daysInRangeInclusive(range.from, range.to)
  const prevPeriodSuffix = `vs previous ${rangeDayCount} days`

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2.5">
          <DateRangeSelector
            value={range}
            onChange={handleRangeChange}
            disabled={metricsLoading}
          />
        </div>
      </div>

      {/* Headline numbers — five figures in one white panel. Five
          columns at xl rather than 4, or the fifth is stranded alone on
          a second row. The vertical rules only at xl, where the five
          share one row: `divide-x` on a wrapped grid would also rule the
          first figure of every later row. The panel's own py keeps them
          short of its top and bottom edges. */}
      <div className="grid grid-cols-1 gap-y-2 rounded-xl bg-card py-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:divide-x xl:divide-border">
        {metricsLoading || !metrics ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              title="New Conversations"
              icon={MessageSquare}
              value={metrics.newConversations.current.toLocaleString()}
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
              icon={UserPlus}
              value={metrics.newContacts.current.toLocaleString()}
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
              icon={IndianRupee}
              value={formatCurrency(metrics.openDealsValue, defaultCurrency)}
              subtitle={`${metrics.openDealsCount} open deal${metrics.openDealsCount === 1 ? '' : 's'}`}
            />
            <MetricCard
              title="Messages Sent"
              icon={Send}
              value={metrics.messagesSent.current.toLocaleString()}
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
              icon={AlertTriangle}
              value={metrics.messagesFailed.current.toLocaleString()}
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

      {/* Team — who is on now and since when, who was last seen when. */}
      <TeamPresence />

      {/* Quick links — where to set things up, and the guide for each. */}
      <QuickLinks />
    </div>
  )
}

// ------------------------------------------------------------

function deltaLabel(delta: number, suffix: string): string {
  if (delta === 0) return `No change ${suffix}`
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toLocaleString()} ${suffix}`
}
