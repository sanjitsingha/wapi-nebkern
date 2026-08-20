'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { Delete, Loader2, Phone, Search } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { avatarColor } from '@/lib/avatar-color';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCallCenter } from './call-center';
// Outcome icons and duration formatting are shared with the inbox side
// panel — two places showing the same call must not describe it two ways.
import { callOutcome, formatCallDuration } from './contact-call-history';

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
        {/* No Refresh button: the realtime subscription below already
            puts new and updated calls on the page as they happen, so it
            re-fetched what was almost always current. */}
        <Dialer />
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
              const { Icon, tone, label } = callOutcome(call.status, call.direction);
              const when = call.started_at ?? call.created_at;
              const name =
                call.contact?.name?.trim() || call.contact?.phone || 'Unknown number';
              // Same seed as the conversation list, thread header and
              // contact panel (`contact.id || displayName`), so a person
              // wears one colour everywhere in the app.
              const avatar = avatarColor(call.contact?.id || name);
              return (
                <li key={call.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="relative shrink-0">
                    <span
                      className="flex size-9 items-center justify-center rounded-full text-sm font-semibold"
                      style={{ backgroundColor: avatar.bg, color: avatar.fg }}
                    >
                      {name.charAt(0).toUpperCase()}
                    </span>
                    {/* The outcome rides as a badge on the avatar rather
                        than replacing it — the colour is the identity,
                        the icon is what happened. */}
                    <span
                      className={cn(
                        'absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-card',
                        tone,
                      )}
                    >
                      <Icon className="size-3" />
                    </span>
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
                      {formatCallDuration(call.duration_seconds)}
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

// A phone keypad, letters and all. The sub-labels carry no function —
// they are what makes a 3×4 grid of digits read as a dialpad at a glance
// instead of a numeric keyboard.
const KEYPAD: { digit: string; letters?: string }[] = [
  { digit: '1' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*' },
  { digit: '0', letters: '+' },
  { digit: '#' },
];

/**
 * Dial a number that isn't in the list yet.
 *
 * Raw international number, no country-code picker: WhatsApp identifies
 * people by full E.164, and a picker that guesses the wrong default is
 * how calls go to the wrong country. The field stays typeable — the
 * keypad is for the phone-shaped half of the audience, the keyboard for
 * everyone pasting a number from somewhere else.
 */
function Dialer() {
  const callCenter = useCallCenter();
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState('');

  if (!callCenter) return null;

  const dial = () => {
    const trimmed = number.trim();
    if (!trimmed) return;
    void callCenter.placeCall(trimmed);
    setNumber('');
    setOpen(false);
  };

  const press = (digit: string) => {
    // Long-press-free "+": 0 is the only key that carries it, matching
    // every hardware dialpad, and it only makes sense leading.
    setNumber((prev) => (digit === '+' && prev.length > 0 ? prev : prev + digit));
  };

  return (
    <>
      {/* The page's only action now that Refresh is gone, so it carries
          the primary treatment at the same h-11 the other dashboard
          pages use for their lead button. The explicit hover matters:
          the `default` variant's own hover is scoped to `[a]:`, so a
          real <button> gets none of it.

          `px-6` overrides the `px-2.5` the default size ships with —
          that value is tuned for the h-8 button it was written for and
          leaves the label crowded against the edges at this height. */}
      <Button
        onClick={() => setOpen(true)}
        disabled={callCenter.busy}
        className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-6"
      >
        <Phone className="size-4" />
        New call
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>New call</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Input
                autoFocus
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') dial();
                }}
                placeholder="+91 98765 43210"
                // Tabular figures so digits don't jiggle as they land.
                className="h-12 pr-10 text-center font-mono text-lg tracking-wider tabular-nums"
                aria-label="Number to call"
              />
              {number && (
                <button
                  type="button"
                  onClick={() => setNumber((p) => p.slice(0, -1))}
                  aria-label="Delete last digit"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Delete className="size-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {KEYPAD.map((key) => (
                <button
                  key={key.digit}
                  type="button"
                  onClick={() => press(key.digit === '0' ? '0' : key.digit)}
                  // The 0 key doubles as "+" on a long press everywhere
                  // else; here the secondary label is a second target
                  // rather than a hidden gesture nobody discovers.
                  onContextMenu={(e) => {
                    if (key.digit !== '0') return;
                    e.preventDefault();
                    press('+');
                  }}
                  className="flex h-14 flex-col items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-muted active:bg-primary-soft"
                >
                  <span className="text-lg leading-none font-semibold text-foreground">
                    {key.digit}
                  </span>
                  {key.letters && (
                    <span className="mt-0.5 text-[9px] leading-none font-medium tracking-widest text-muted-foreground">
                      {key.letters}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <Button
              onClick={dial}
              disabled={!number.trim() || callCenter.busy}
              className="h-12 w-full bg-primary text-base"
            >
              <Phone className="size-4" />
              Call
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
