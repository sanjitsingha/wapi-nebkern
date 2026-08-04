'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Phone,
  PhoneMissed,
  PhoneOff,
  RefreshCw,
  Search,
  TriangleAlert,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCallCenter } from './call-center';

// ============================================================
// WhatsApp call history.
//
// Reads `call_logs` straight through the RLS-scoped browser client, the
// same way the inbox reads conversations — the table is member-readable
// by policy and writable only by the webhook's service-role client
// (migration 050), so there is nothing an API route in front of it would
// add beyond a hop.
//
// Rows arrive from the webhook: `connect` opens one as 'ringing' and
// `terminate` finalizes it with an outcome and duration. A row still
// sitting at 'ringing' therefore means the call never reported an end —
// in flight, or an event Meta never delivered.
// ============================================================

const PAGE_SIZE = 50;

interface CallRow {
  id: string;
  wa_call_id: string;
  direction: 'inbound' | 'outbound';
  status: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  conversation_id: string | null;
  contact: { id: string; name: string | null; phone: string | null } | null;
}

type StatusFilter = 'all' | 'completed' | 'missed' | 'inbound' | 'outbound';

const FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'Missed', value: 'missed' },
  { label: 'Incoming', value: 'inbound' },
  { label: 'Outgoing', value: 'outbound' },
];

/** Outcome → how the row reads. `ringing` is deliberately its own look:
 *  it is not a result, it is the absence of one. */
function statusStyle(status: string, direction: string) {
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
      return { Icon: Phone, tone: 'text-muted-foreground', label: 'No end recorded' };
    default:
      return { Icon: TriangleAlert, tone: 'text-muted-foreground', label: 'Failed' };
  }
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function CallHistory() {
  const supabase = useMemo(() => createClient(), []);
  const callCenter = useCallCenter();

  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const load = useCallback(
    async (pageIndex: number, append: boolean) => {
      if (append) setRefreshing(true);
      else setLoading(true);
      try {
        // The contact join is what turns an opaque wa_call_id into a
        // human row; it stays a left join so a call whose contact was
        // later deleted still shows up (the FK is ON DELETE SET NULL).
        const { data, error: err } = await supabase
          .from('call_logs')
          .select(
            'id, wa_call_id, direction, status, started_at, ended_at, duration_seconds, created_at, conversation_id, contact:contacts(id, name, phone)',
          )
          .order('created_at', { ascending: false })
          .range(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE - 1);

        if (err) throw err;

        const rows = (data ?? []) as unknown as CallRow[];
        setHasMore(rows.length === PAGE_SIZE);
        setCalls((prev) => (append ? [...prev, ...rows] : rows));
        setError('');
      } catch {
        setError('Could not load call history.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    load(0, false);
  }, [load]);

  // Live updates: the webhook writes these rows, so a call that lands
  // while this page is open should appear without a refresh — same
  // Realtime channel pattern the inbox uses for messages.
  useEffect(() => {
    const channel = supabase
      .channel('call-logs-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_logs' },
        () => {
          setPage(0);
          load(0, false);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return calls.filter((c) => {
      if (filter === 'inbound' || filter === 'outbound') {
        if (c.direction !== filter) return false;
      } else if (filter !== 'all' && c.status !== filter) {
        return false;
      }
      if (!q) return true;
      return (
        (c.contact?.name ?? '').toLowerCase().includes(q) ||
        (c.contact?.phone ?? '').toLowerCase().includes(q)
      );
    });
  }, [calls, filter, search]);

  const stats = useMemo(() => {
    const completed = calls.filter((c) => c.status === 'completed');
    const totalSeconds = completed.reduce(
      (sum, c) => sum + (c.duration_seconds ?? 0),
      0,
    );
    return {
      total: calls.length,
      missed: calls.filter((c) => c.status === 'missed').length,
      completed: completed.length,
      minutes: Math.round(totalSeconds / 60),
    };
  }, [calls]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Calls</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every WhatsApp voice call to and from your business number.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPage(0);
              load(0, false);
            }}
            disabled={loading || refreshing}
          >
            <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Dialer />
        </div>
      </div>

      {/* Totals are over what's loaded, not the whole table — labelled as
          "recent" rather than implying an all-time figure the query never
          asked for. */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Recent calls" value={String(stats.total)} />
        <Stat label="Completed" value={String(stats.completed)} />
        <Stat label="Missed" value={String(stats.missed)} tone="text-red-500" />
        <Stat label="Talk time" value={`${stats.minutes} min`} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or number..."
            className="border-border bg-muted pl-9 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                'inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors',
                filter === f.value
                  ? 'border-primary/30 bg-primary-soft text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">{error}</p>
        ) : visible.length === 0 ? (
          <EmptyState hasAny={calls.length > 0} />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((call) => {
              const { Icon, tone, label } = statusStyle(call.status, call.direction);
              const when = call.started_at ?? call.created_at;
              const name =
                call.contact?.name?.trim() || call.contact?.phone || 'Unknown number';
              return (
                <li key={call.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-full bg-muted',
                      tone,
                    )}
                  >
                    <Icon className="size-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {label}
                      {call.contact?.phone && call.contact?.name
                        ? ` · ${call.contact.phone}`
                        : ''}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-foreground">
                      {formatDuration(call.duration_seconds)}
                    </p>
                    {/* Absolute time in the title: "3 days ago" is easier
                        to scan but useless when someone needs the actual
                        timestamp for a dispute. */}
                    <p
                      className="text-xs text-muted-foreground"
                      title={format(new Date(when), 'PPpp')}
                    >
                      {formatDistanceToNow(new Date(when), { addSuffix: true })}
                    </p>
                  </div>

                  {call.contact?.phone && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Call ${name} back`}
                      disabled={callCenter?.busy}
                      onClick={() =>
                        callCenter?.placeCall(call.contact!.phone!, name)
                      }
                      className="shrink-0 text-muted-foreground hover:text-primary"
                    >
                      <Phone className="size-4" />
                    </Button>
                  )}

                  {call.conversation_id && (
                    <Link
                      href={`/inbox?conversation=${call.conversation_id}`}
                      className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Open chat
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              const next = page + 1;
              setPage(next);
              load(next, true);
            }}
            disabled={refreshing}
          >
            {refreshing && <Loader2 className="size-4 animate-spin" />}
            Load older calls
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Dial a number that isn't in the list yet.
 *
 * Deliberately raw E.164 with no country-code picker: WhatsApp itself
 * identifies people by full international number, and a picker that
 * guesses the wrong default is how calls go to the wrong country.
 */
function Dialer() {
  const callCenter = useCallCenter();
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState('');

  if (!callCenter) return null;

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)} disabled={callCenter.busy}>
        <Phone className="size-4" />
        New call
      </Button>
    );
  }

  const dial = () => {
    const trimmed = number.trim();
    if (!trimmed) return;
    void callCenter.placeCall(trimmed);
    setNumber('');
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Input
        autoFocus
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') dial();
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="+91 98765 43210"
        className="h-9 w-44 text-sm"
      />
      <Button size="sm" onClick={dial} disabled={!number.trim() || callCenter.busy}>
        Call
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tracking-tight text-foreground', tone)}>
        {value}
      </p>
    </div>
  );
}

/**
 * Two very different empty states behind one component: a filter that
 * matched nothing is a dead end the user can back out of, while no calls
 * at all usually means calling was never switched on — so that one
 * points at the setting rather than just shrugging.
 */
function EmptyState({ hasAny }: { hasAny: boolean }) {
  if (hasAny) {
    return (
      <p className="px-5 py-12 text-center text-sm text-muted-foreground">
        No calls match this filter.
      </p>
    );
  }
  return (
    <div className="px-5 py-14 text-center">
      <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Phone className="size-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-foreground">No calls yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Calls appear here once customers start calling your WhatsApp
        number. Switch calling on under{' '}
        <Link
          href="/settings/calling"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Settings → Calling
        </Link>{' '}
        to show the call button in chats.
      </p>
    </div>
  );
}
