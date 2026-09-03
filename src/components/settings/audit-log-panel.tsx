'use client';

// ============================================================
// Settings → Activity log (admin+).
//
// Reads /api/account/audit-logs (admin-gated + RLS-scoped) and renders the
// account's who-did-what-when feed as a table, with filters for team
// member and event category and server-side numbered paging. A row
// expands in place to show the full detail of the event (target, IP,
// device, raw metadata). Actor avatars are resolved from the live team
// roster; a removed teammate falls back to their snapshot name.
// ============================================================

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Activity,
  CalendarDays,
  ChevronDown,
  Layers,
  Loader2,
  ScrollText,
  ShieldAlert,
  TextCursorInput,
  User,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useTeamMembers } from '@/hooks/reference-data';
import {
  actionCategory,
  actionLabel,
  AUDIT_CATEGORIES,
  type AuditLogEntry,
} from '@/lib/audit/events';
import { SettingsPanelHead } from './settings-panel-head';

// A solid dot per category — a colour cue that reads at a glance without
// the pill/background the rest of the tables have shed.
const CATEGORY_DOT: Record<string, string> = {
  team: 'bg-primary',
  billing: 'bg-emerald-500',
  conversations: 'bg-blue-500',
  contacts: 'bg-sky-500',
  fields: 'bg-teal-500',
  calls: 'bg-indigo-500',
  deals: 'bg-amber-500',
  broadcast: 'bg-violet-500',
  channel: 'bg-fuchsia-500',
  system: 'bg-red-500',
  other: 'bg-muted-foreground',
};

/** A short human detail line from a row's metadata (e.g. "agent → admin"). */
function metaSummary(entry: AuditLogEntry): string | null {
  const m = entry.metadata || {};
  if (typeof m.from === 'string' && typeof m.to === 'string') {
    return `${m.from} → ${m.to}`;
  }
  // A changed-fields list (contact.updated) reads better as a sentence.
  if (Array.isArray(m.fields) && m.fields.length) {
    return `Changed ${m.fields.join(', ')}`;
  }
  const parts: string[] = [];
  for (const [k, v] of Object.entries(m)) {
    if (v == null || typeof v === 'object') continue;
    parts.push(`${k}: ${String(v)}`);
    if (parts.length >= 3) break;
  }
  return parts.length ? parts.join(' · ') : null;
}

const PAGE = 25;

export function AuditLogPanel() {
  const { canManageMembers } = useAuth();
  const { data: members = [] } = useTeamMembers();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actor, setActor] = useState('all');
  const [category, setCategory] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const memberById = useMemo(() => {
    const map = new Map<string, { name: string; avatarUrl: string | null }>();
    for (const m of members) {
      if (m.user_id) {
        map.set(m.user_id, {
          name: m.full_name || m.email || 'Teammate',
          avatarUrl: m.avatar_url ?? null,
        });
      }
    }
    return map;
  }, [members]);

  const load = useCallback(
    async (pageIndex: number) => {
      const params = new URLSearchParams();
      if (actor !== 'all') params.set('actor', actor);
      if (category !== 'all') params.set('category', category);
      params.set('limit', String(PAGE));
      params.set('offset', String((pageIndex - 1) * PAGE));

      setLoading(true);
      try {
        const res = await fetch(`/api/account/audit-logs?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          toast.error(payload.error || 'Failed to load the activity log');
          return;
        }
        const data = (await res.json()) as {
          logs: AuditLogEntry[];
          total: number;
        };
        setLogs(data.logs);
        setTotal(data.total);
      } catch {
        toast.error('Could not reach the server');
      } finally {
        setLoading(false);
      }
    },
    [actor, category],
  );

  // Filters reset paging to the first page; the load then follows `page`.
  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [actor, category]);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  if (!canManageMembers) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="Activity log"
          description="Who did what across your account."
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <ShieldAlert className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Admins only</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              The activity log is visible to account owners and admins.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="animate-in fade-in-50 space-y-5 duration-200">
      <SettingsPanelHead
        title="Activity log"
        description="A record of important actions across your account — who did what, when, and from where. Errors, calls, tag and field changes, and contact edits are all captured here."
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Select value={actor} onValueChange={(v) => v && setActor(v)}>
          <SelectTrigger className="h-9 w-48 border-border bg-muted">
            <SelectValue placeholder="All members" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All members</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.user_id}>
                {m.full_name || m.email || 'Teammate'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={category} onValueChange={(v) => v && setCategory(v)}>
          <SelectTrigger className="h-9 w-48 border-border bg-muted">
            <SelectValue placeholder="All events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {AUDIT_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <ScrollText className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No activity yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Actions like tagging a contact, a failed message, or a call will
              show up here.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-6 py-3.5 text-muted-foreground" icon={User}>
                  Who
                </TableHead>
                <TableHead className="px-6 py-3.5 text-muted-foreground" icon={Activity}>
                  Event
                </TableHead>
                <TableHead
                  className="hidden px-6 py-3.5 text-muted-foreground md:table-cell"
                  icon={TextCursorInput}
                >
                  Details
                </TableHead>
                <TableHead
                  className="hidden px-6 py-3.5 text-muted-foreground sm:table-cell"
                  icon={Layers}
                >
                  Category
                </TableHead>
                <TableHead
                  className="hidden px-6 py-3.5 text-muted-foreground lg:table-cell"
                  icon={CalendarDays}
                >
                  When
                </TableHead>
                <TableHead className="w-10 px-6 py-3.5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((entry) => {
                const member = entry.actorUserId
                  ? memberById.get(entry.actorUserId)
                  : undefined;
                const actorName = entry.actorName || member?.name || 'System';
                const cat = actionCategory(entry.action);
                const detail = metaSummary(entry);
                const when = new Date(entry.createdAt);
                const open = expandedId === entry.id;

                return (
                  <Fragment key={entry.id}>
                    <TableRow
                      onClick={() =>
                        setExpandedId((id) => (id === entry.id ? null : entry.id))
                      }
                      aria-expanded={open}
                      className="cursor-pointer border-border hover:bg-muted/40"
                    >
                      <TableCell className="px-6 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="size-8 shrink-0">
                            {member?.avatarUrl ? (
                              <AvatarImage src={member.avatarUrl} alt={actorName} />
                            ) : null}
                            <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                              {actorName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate font-medium text-foreground">
                            {actorName}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="px-6 py-4">
                        <span
                          className={cn(
                            'text-sm',
                            cat === 'system'
                              ? 'font-medium text-red-600 dark:text-red-400'
                              : 'text-foreground',
                          )}
                        >
                          {actionLabel(entry.action)}
                        </span>
                      </TableCell>

                      <TableCell className="hidden max-w-xs px-6 py-4 md:table-cell">
                        {entry.targetLabel ? (
                          <span className="truncate font-medium text-foreground">
                            {entry.targetLabel}
                          </span>
                        ) : null}
                        {detail && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {detail}
                          </span>
                        )}
                        {!entry.targetLabel && !detail && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="hidden px-6 py-4 sm:table-cell">
                        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground capitalize">
                          <span
                            className={cn(
                              'size-2 shrink-0 rounded-full',
                              CATEGORY_DOT[cat] ?? CATEGORY_DOT.other,
                            )}
                          />
                          {cat}
                        </span>
                      </TableCell>

                      <TableCell
                        className="hidden px-6 py-4 text-sm whitespace-nowrap text-muted-foreground lg:table-cell"
                        title={formatDistanceToNow(when, { addSuffix: true })}
                      >
                        {format(when, 'MMM d, yyyy · h:mm a')}
                      </TableCell>

                      <TableCell className="px-6 py-4 text-right">
                        <ChevronDown
                          className={cn(
                            'inline size-4 text-muted-foreground transition-transform',
                            open && 'rotate-180',
                          )}
                        />
                      </TableCell>
                    </TableRow>

                    {open && (
                      <TableRow className="border-border bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={6} className="px-6 py-4">
                          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                            <DetailRow label="When" value={format(when, 'PPpp')} />
                            <DetailRow
                              label="Actor"
                              value={
                                entry.actorUserId
                                  ? `${actorName} · ${entry.actorUserId}`
                                  : actorName
                              }
                            />
                            <DetailRow label="Event" value={entry.action} mono />
                            {(entry.targetType ||
                              entry.targetLabel ||
                              entry.targetId) && (
                              <DetailRow
                                label="Target"
                                value={[
                                  entry.targetType,
                                  entry.targetLabel,
                                  entry.targetId,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              />
                            )}
                            {entry.ip && <DetailRow label="IP" value={entry.ip} mono />}
                            {entry.userAgent && (
                              <DetailRow label="Device" value={entry.userAgent} />
                            )}
                            {Object.entries(entry.metadata).map(([k, v]) =>
                              v == null || typeof v === 'object' ? null : (
                                <DetailRow key={k} label={k} value={String(v)} />
                              ),
                            )}
                          </dl>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {!loading && (
        <TablePagination
          page={page}
          pageSize={PAGE}
          total={total}
          onPageChange={setPage}
        />
      )}
    </section>
  );
}

/** One label/value pair inside an expanded row's detail grid. */
function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <>
      <dt className="font-medium text-muted-foreground capitalize">{label}</dt>
      <dd
        className={cn(
          'min-w-0 break-words text-foreground',
          mono && 'font-mono text-[11px]',
        )}
      >
        {value}
      </dd>
    </>
  );
}
