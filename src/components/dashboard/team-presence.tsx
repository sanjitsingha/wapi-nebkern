'use client'

import { useEffect, useMemo, useState } from 'react'
import { UsersRound } from 'lucide-react'

import { cn } from '@/lib/utils'
import { usePresence } from '@/hooks/use-presence'
import { presenceSince, type PresenceStatus } from '@/lib/presence'
import { PersonAvatar } from '@/components/ui/person-avatar'
import { PRESENCE_DOT_CLASS } from '@/components/presence/presence-dot'
import { Skeleton } from '@/components/dashboard/skeleton'
import type { AccountMember } from '@/types'

// ============================================================
// Team — everyone on the account, who is on right now and since when,
// and when the rest were last seen. Live: presence rows stream in over
// Realtime and the hook re-derives "offline" on its own clock, so a
// closed tab drops to "Last seen …" without a reload.
// ============================================================

const STATUS_TEXT: Record<PresenceStatus, string> = {
  online: 'text-emerald-600 dark:text-emerald-400',
  away: 'text-amber-600 dark:text-amber-400',
  offline: 'text-muted-foreground',
}

// Who is on comes first; within a group, by name.
const STATUS_ORDER: Record<PresenceStatus, number> = { online: 0, away: 1, offline: 2 }

export function TeamPresence() {
  const { getPresence, getRow, now } = usePresence()
  const [members, setMembers] = useState<AccountMember[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/account/members', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: { members: AccountMember[] }) => {
        if (!cancelled) setMembers(body.members)
      })
      .catch((err) => {
        console.error('[dashboard] team failed:', err)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const rows = useMemo(() => {
    if (!members) return null
    return members
      .map((m) => ({ member: m, status: getPresence(m.user_id), row: getRow(m.user_id) }))
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          (a.member.full_name || '').localeCompare(b.member.full_name || ''),
      )
  }, [members, getPresence, getRow])

  const onlineCount = rows?.filter((r) => r.status !== 'offline').length ?? 0

  return (
    <section aria-labelledby="team-heading" className="rounded-xl bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h2
          id="team-heading"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
        >
          <UsersRound className="size-4" />
          Team
        </h2>
        {rows && (
          <span className="text-xs text-muted-foreground">
            {onlineCount} of {rows.length} online
          </span>
        )}
      </div>

      {failed ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Couldn&apos;t load your team.</p>
      ) : !rows ? (
        <div className="divide-y divide-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="ml-auto h-3 w-28" />
            </div>
          ))}
        </div>
      ) : (
        // One teammate per row: who on the left, their status on the right.
        <ul className="divide-y divide-border">
          {rows.map(({ member, status, row }) => {
            const name = member.full_name || member.email || 'Teammate'
            return (
              <li key={member.user_id} className="flex items-center gap-3 px-5 py-3">
                <span className="relative shrink-0">
                  <PersonAvatar
                    name={name}
                    avatarUrl={member.avatar_url}
                    className="size-9 text-sm"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      'absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-card',
                      PRESENCE_DOT_CLASS[status],
                    )}
                  />
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {name}
                </p>
                <p className={cn('shrink-0 text-xs', STATUS_TEXT[status])}>
                  {presenceSince(status, row, now)}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
