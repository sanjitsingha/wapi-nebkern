'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Loader2,
  PhoneMissed,
  PhoneOff,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

// ============================================================
// One contact's calls, for the inbox side panel.
//
// A compact sibling of the full /calls table: same rows, same source,
// but scoped to whoever is selected and trimmed to what fits a 22rem
// column — outcome, when, how long. Anything more belongs on /calls.
// ============================================================

/**
 * How many calls the panel shows.
 *
 * Three, not the eight this used to render. The panel is a column of
 * stacked sections and this one sat in the middle of it, so a chatty
 * contact's history pushed everything below it — notes, tags, spam —
 * far enough down to be a scroll away. A recent-calls list is a glance,
 * not a record; the record is /calls.
 */
const PREVIEW_LIMIT = 3;

/** Fetch one more than we show, purely to learn whether there IS more.
 *  Cheaper than a second count query for a panel that re-fetches on
 *  every realtime call event. */
const FETCH_LIMIT = PREVIEW_LIMIT + 1;

interface Row {
  id: string;
  direction: 'inbound' | 'outbound';
  status: string;
  started_at: string | null;
  created_at: string;
  duration_seconds: number | null;
}

/** Shared with the /calls table so an outcome never reads two ways. */
export function callOutcome(status: string, direction: string) {
  switch (status) {
    case 'completed':
      return {
        Icon: direction === 'inbound' ? ArrowDownLeft : ArrowUpRight,
        tone: 'text-primary',
        label: direction === 'inbound' ? 'Incoming' : 'Outgoing',
      };
    case 'missed':
      return { Icon: PhoneMissed, tone: 'text-red-500', label: 'Missed' };
    case 'declined':
      return { Icon: PhoneOff, tone: 'text-amber-500', label: 'Declined' };
    case 'ringing':
      return { Icon: ArrowDownLeft, tone: 'text-muted-foreground', label: 'No end recorded' };
    default:
      return { Icon: PhoneOff, tone: 'text-muted-foreground', label: 'Failed' };
  }
}

export function formatCallDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function ContactCallHistory({ contactId }: { contactId: string }) {
  const supabase = useMemo(() => createClient(), []);

  // The loaded rows carry the contact they belong to, and the render
  // ignores them unless that still matches. Selecting a new conversation
  // therefore shows a spinner rather than the previous contact's calls,
  // without a synchronous reset in the effect below.
  const [loaded, setLoaded] = useState<{ contactId: string; rows: Row[] } | null>(null);
  const rows = loaded?.contactId === contactId ? loaded.rows : null;

  // Fetching is kept free of setState so the update always happens in a
  // callback rather than in an effect body — the shape React (and this
  // repo's lint rule) asks for.
  const fetchRows = useCallback(async (): Promise<Row[]> => {
    const { data } = await supabase
      .from('call_logs')
      .select('id, direction, status, started_at, created_at, duration_seconds')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(FETCH_LIMIT);
    return (data ?? []) as Row[];
  }, [supabase, contactId]);

  useEffect(() => {
    let cancelled = false;
    void fetchRows().then((next) => {
      if (!cancelled) setLoaded({ contactId, rows: next });
    });
    return () => {
      cancelled = true;
    };
  }, [fetchRows, contactId]);

  // A call that starts or ends while this panel is open should land in
  // the list — the agent is very likely looking right at it. The filter
  // keeps the subscription to this one contact rather than waking every
  // open panel on every call in the account.
  useEffect(() => {
    const channel = supabase
      .channel(`contact-calls-${contactId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_logs', filter: `contact_id=eq.${contactId}` },
        () => {
          void fetchRows().then((next) => setLoaded({ contactId, rows: next }));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, contactId, fetchRows]);

  if (rows === null) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">No calls with this contact yet.</p>
    );
  }

  const visible = rows.slice(0, PREVIEW_LIMIT);
  const hasMore = rows.length > PREVIEW_LIMIT;

  return (
    <>
    <ul className="space-y-1">
      {visible.map((row) => {
        const { Icon, tone, label } = callOutcome(row.status, row.direction);
        const when = row.started_at ?? row.created_at;
        return (
          <li
            key={row.id}
            className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-colors hover:bg-muted"
          >
            <Icon className={cn('size-3.5 shrink-0', tone)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{label}</p>
              <p
                className="truncate text-[11px] text-muted-foreground"
                title={format(new Date(when), 'PPpp')}
              >
                {formatDistanceToNow(new Date(when), { addSuffix: true })}
              </p>
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatCallDuration(row.duration_seconds)}
            </span>
          </li>
        );
      })}
    </ul>

      {/* Always offered once there is any history, not only when the
          preview overflows: /calls is where the full record lives, and
          hiding the way there whenever a contact happens to have three
          calls or fewer makes it findable only by accident. The count
          hint appears only when it is true. */}
      <Link
        href="/calls"
        className="text-muted-foreground hover:text-foreground hover:bg-muted mt-1 flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors"
      >
        <span>{hasMore ? 'View all calls' : 'View call history'}</span>
        <ChevronRight className="size-3.5 shrink-0" />
      </Link>
    </>
  );
}
