'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  CalendarDays,
  CircleDot,
  Clock,
  Delete,
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneIncoming,
  PhoneOff,
  Search,
  User,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { avatarColor } from '@/lib/avatar-color';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { OpenRowButton } from '@/components/ui/open-row-button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  STATE_LABEL,
  useCallCenter,
  useElapsed,
  type ActiveCall,
} from './call-center';
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
  const router = useRouter();
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
  const [dialerOpen, setDialerOpen] = useState(false);

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
        {callCenter && (
          <Button
            onClick={() => setDialerOpen(true)}
            disabled={callCenter.busy}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-6"
          >
            <Phone className="size-4" />
            New call
          </Button>
        )}
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

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">{error}</p>
        ) : visible.length === 0 ? (
          <EmptyState hasAny={calls.length > 0} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-6 py-3.5 text-muted-foreground" icon={User}>
                  Contact
                </TableHead>
                <TableHead
                  className="hidden px-6 py-3.5 text-muted-foreground md:table-cell"
                  icon={Phone}
                >
                  Phone
                </TableHead>
                <TableHead className="px-6 py-3.5 text-muted-foreground" icon={CircleDot}>
                  Outcome
                </TableHead>
                <TableHead
                  className="hidden px-6 py-3.5 text-muted-foreground sm:table-cell"
                  icon={Clock}
                >
                  Duration
                </TableHead>
                <TableHead
                  className="hidden px-6 py-3.5 text-muted-foreground lg:table-cell"
                  icon={CalendarDays}
                >
                  When
                </TableHead>
                <TableHead className="px-6 py-3.5 text-right text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((call) => {
                const { Icon, tone, label } = callOutcome(call.status, call.direction);
                const when = call.started_at ?? call.created_at;
                const name =
                  call.contact?.name?.trim() ||
                  call.contact?.phone ||
                  'Unknown number';
                // Same seed as the conversation list, thread header and
                // contact panel (`contact.id || displayName`), so a person
                // wears one colour everywhere in the app.
                const avatar = avatarColor(call.contact?.id || name);
                return (
                  <TableRow key={call.id} className="border-border hover:bg-muted/40">
                    <TableCell className="group/cell px-6 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                            style={{ backgroundColor: avatar.bg, color: avatar.fg }}
                          >
                            {name.charAt(0).toUpperCase()}
                          </span>
                          <span className="truncate font-medium text-foreground">
                            {name}
                          </span>
                        </div>
                        {call.conversation_id && (
                          <OpenRowButton
                            label="Open chat"
                            stopPropagation={false}
                            onClick={() =>
                              router.push(
                                `/inbox?conversation=${call.conversation_id}`,
                              )
                            }
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden px-6 py-4 text-sm text-muted-foreground tabular-nums md:table-cell">
                      {call.contact?.phone ?? '—'}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <span className="inline-flex items-center gap-2 text-sm text-foreground">
                        <Icon className={cn('size-4 shrink-0', tone)} />
                        {label}
                      </span>
                    </TableCell>
                    <TableCell className="hidden px-6 py-4 text-sm text-muted-foreground tabular-nums sm:table-cell">
                      {formatCallDuration(call.duration_seconds)}
                    </TableCell>
                    <TableCell
                      className="hidden px-6 py-4 text-sm text-muted-foreground whitespace-nowrap lg:table-cell"
                      title={format(new Date(when), 'PPpp')}
                    >
                      {format(new Date(when), 'MMM d, yyyy · h:mm a')}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      {call.contact?.phone ? (
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
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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

      <CallDock open={dialerOpen} onOpenChange={setDialerOpen} />
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
 * The New-call surface: a right-side overlay drawer that floats over the
 * list, and — once a call is placed — turns into the in-call screen in the
 * same panel instead of closing.
 *
 * `visible` is `open` OR a live call: dialling never closes it, and an
 * active call keeps it on screen even if the user never opened the dialer
 * (a call-back from the list, say). Closing is blocked while a call is up
 * — End call is the way out then.
 *
 * While it shows the call it tells the provider to hold back the floating
 * panel (`setDockedInCall`), so the same call is never drawn twice.
 */
function CallDock({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const callCenter = useCallCenter();
  const [number, setNumber] = useState('');

  const activeCall = callCenter?.activeCall ?? null;
  const visible = open || activeCall !== null;
  const setDocked = callCenter?.setDockedInCall;

  // Own the call visually only while this panel is actually showing it,
  // and hand it back on unmount so leaving /calls restores the floating
  // panel mid-call.
  useEffect(() => {
    const owning = visible && activeCall !== null;
    setDocked?.(owning);
    return () => setDocked?.(false);
  }, [visible, activeCall, setDocked]);

  if (!callCenter) return null;

  const dial = () => {
    const trimmed = number.trim();
    if (!trimmed) return;
    // No close: the panel stays and the in-call view takes over as soon
    // as `activeCall` lands.
    void callCenter.placeCall(trimmed);
    setNumber('');
  };

  const press = (digit: string) => {
    // Long-press-free "+": 0 is the only key that carries it, matching
    // every hardware dialpad, and it only makes sense leading.
    setNumber((prev) => (digit === '+' && prev.length > 0 ? prev : prev + digit));
  };

  return (
    <Sheet
      open={visible}
      onOpenChange={(next) => {
        // A live call owns the panel: the backdrop and Esc can't dismiss
        // it out from under an in-progress call — End call does that.
        if (!next && activeCall) return;
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={!activeCall}
        className="flex w-full flex-col gap-0 border-l border-border bg-background p-0 sm:max-w-sm"
      >
        {activeCall ? (
          <>
            <SheetHeader className="sr-only">
              <SheetTitle>Call in progress</SheetTitle>
            </SheetHeader>
            <InCallView
              call={activeCall}
              ringing={callCenter.ringing}
              muted={callCenter.muted}
              working={callCenter.working}
              onAnswer={callCenter.answer}
              onDecline={callCenter.decline}
              onHangUp={callCenter.hangUp}
              onToggleMute={callCenter.toggleMute}
            />
          </>
        ) : (
          <>
            <SheetHeader className="border-b border-border px-5 py-4">
              <SheetTitle className="flex items-center gap-2 text-foreground">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Phone className="size-4" />
                </span>
                New call
              </SheetTitle>
            </SheetHeader>

            <div className="flex flex-1 flex-col overflow-y-auto px-5 pt-6 pb-5">
              {/* Borderless number line — a display that happens to be
                  typeable, not a boxed field, so the keypad below reads
                  as the primary input. */}
              <div className="relative">
                <input
                  autoFocus
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') dial();
                  }}
                  placeholder="+91 98765 43210"
                  aria-label="Number to call"
                  className="w-full border-0 bg-transparent px-8 text-center font-mono text-2xl tracking-wider tabular-nums text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                />
                {number && (
                  <button
                    type="button"
                    onClick={() => setNumber((p) => p.slice(0, -1))}
                    aria-label="Delete last digit"
                    className="absolute top-1/2 right-0 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Delete className="size-4" />
                  </button>
                )}
              </div>

              <p className="mt-2 text-center text-xs text-muted-foreground">
                Full international number, with country code.
              </p>

              {/* mt-auto drops the pad to the bottom of the panel. */}
              <div className="mx-auto mt-auto grid w-full max-w-xs grid-cols-3 gap-2.5 pt-8">
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
                    className="flex h-16 flex-col items-center justify-center rounded-2xl border border-border bg-card transition-colors hover:bg-muted active:bg-primary-soft"
                  >
                    <span className="text-xl leading-none font-semibold text-foreground">
                      {key.digit}
                    </span>
                    {key.letters && (
                      <span className="mt-1 text-[9px] leading-none font-medium tracking-widest text-muted-foreground">
                        {key.letters}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-border px-5 py-4">
              <Button
                onClick={dial}
                disabled={!number.trim() || callCenter.busy}
                className="h-13 w-full bg-primary text-base"
              >
                {callCenter.busy ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Phone className="size-5" />
                )}
                Call
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * The in-call screen, WhatsApp-shaped: a big avatar, who you're on with,
 * a status line that becomes the running duration once connected, and the
 * two controls that matter — mute and end. Answer/Decline replace them
 * while an inbound call is still ringing.
 */
function InCallView({
  call,
  ringing,
  muted,
  working,
  onAnswer,
  onDecline,
  onHangUp,
  onToggleMute,
}: {
  call: ActiveCall;
  ringing: boolean;
  muted: boolean;
  working: boolean;
  onAnswer: () => void;
  onDecline: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
}) {
  const elapsed = useElapsed(call.connectedAt);
  const avatar = avatarColor(call.peer);
  const status =
    call.state === 'in-call' && elapsed ? elapsed : STATE_LABEL[call.state];

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-10 text-center">
      <span
        className={cn(
          'flex size-24 items-center justify-center rounded-full text-3xl font-semibold',
          ringing && 'animate-pulse',
        )}
        style={{ backgroundColor: avatar.bg, color: avatar.fg }}
      >
        {call.peer.charAt(0).toUpperCase()}
      </span>

      <p className="mt-5 text-lg font-semibold text-foreground">{call.peer}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
        {ringing && <PhoneIncoming className="size-4 text-primary" />}
        {status}
      </p>

      <div className="mt-auto flex w-full items-center justify-center gap-4 pt-10">
        {ringing ? (
          <>
            <button
              type="button"
              onClick={onDecline}
              disabled={working}
              aria-label="Decline"
              className="flex size-14 items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-600/90 disabled:opacity-60"
            >
              <PhoneOff className="size-6" />
            </button>
            <button
              type="button"
              onClick={onAnswer}
              disabled={working}
              aria-label="Answer"
              className="flex size-14 items-center justify-center rounded-full bg-emerald-600 text-white transition-colors hover:bg-emerald-600/90 disabled:opacity-60"
            >
              {working ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <Phone className="size-6" />
              )}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              aria-pressed={muted}
              className={cn(
                'flex size-14 items-center justify-center rounded-full border transition-colors',
                muted
                  ? 'border-transparent bg-foreground text-background'
                  : 'border-border bg-background text-foreground hover:bg-muted',
              )}
            >
              {muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
            </button>
            <button
              type="button"
              onClick={onHangUp}
              disabled={working}
              aria-label="End call"
              className="flex size-14 items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-600/90 disabled:opacity-60"
            >
              {working ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <PhoneOff className="size-6" />
              )}
            </button>
          </>
        )}
      </div>
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
