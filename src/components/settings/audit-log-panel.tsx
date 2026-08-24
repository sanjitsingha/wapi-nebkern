'use client';

// ============================================================
// Settings → Activity log (admin+).
//
// Reads /api/account/audit-logs (admin-gated + RLS-scoped) and renders the
// account's who-did-what-when feed with filters for team member and event
// category, plus "load more" paging. Actor avatars are resolved from the
// live team roster; a removed teammate falls back to their snapshot name.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ChevronDown, Loader2, ScrollText, ShieldAlert } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useTeamMembers } from '@/hooks/reference-data';
import {
  actionCategory,
  actionLabel,
  AUDIT_CATEGORIES,
  type AuditLogEntry,
} from '@/lib/audit/events';
import { SettingsPanelHead } from './settings-panel-head';

const CATEGORY_TONE: Record<string, string> = {
  team: 'bg-primary/10 text-primary',
  billing: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  conversations: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  contacts: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  deals: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  broadcast: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  channel: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400',
  other: 'bg-muted text-muted-foreground',
};

/** A short human detail line from a row's metadata (e.g. "agent → admin"). */
function metaSummary(entry: AuditLogEntry): string | null {
  const m = entry.metadata || {};
  if (typeof m.from === 'string' && typeof m.to === 'string') {
    return `${m.from} → ${m.to}`;
  }
  const parts: string[] = [];
  for (const [k, v] of Object.entries(m)) {
    if (v == null || typeof v === 'object') continue;
    parts.push(`${k}: ${String(v)}`);
    if (parts.length >= 3) break;
  }
  return parts.length ? parts.join(' · ') : null;
}

const PAGE = 50;

export function AuditLogPanel() {
  const { canManageMembers } = useAuth();
  const { data: members = [] } = useTeamMembers();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
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
    async (offset: number, reset: boolean) => {
      const params = new URLSearchParams();
      if (actor !== 'all') params.set('actor', actor);
      if (category !== 'all') params.set('category', category);
      params.set('limit', String(PAGE));
      params.set('offset', String(offset));

      if (reset) setLoading(true);
      else setLoadingMore(true);
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
          hasMore: boolean;
        };
        setLogs((prev) => (reset ? data.logs : [...prev, ...data.logs]));
        setTotal(data.total);
        setHasMore(data.hasMore);
      } catch {
        toast.error('Could not reach the server');
      } finally {
        if (reset) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [actor, category],
  );

  // Refetch from the top whenever a filter changes (and on mount).
  useEffect(() => {
    void load(0, true);
  }, [load]);

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
            <p className="text-sm font-medium text-foreground">
              Admins only
            </p>
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
        description="A record of important actions across your account — who did what, when, and from where."
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
          <SelectTrigger className="h-9 w-44 border-border bg-muted">
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

        {!loading && (
          <span className="ml-auto text-xs text-muted-foreground">
            {total.toLocaleString()} event{total === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Feed */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <ScrollText className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                No activity yet
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Actions like inviting a teammate, changing a role, or making a
                payment will show up here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
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
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId((id) => (id === entry.id ? null : entry.id))
                      }
                      aria-expanded={open}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                    >
                      <Avatar className="size-8 shrink-0">
                        {member?.avatarUrl ? (
                          <AvatarImage src={member.avatarUrl} alt={actorName} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                          {actorName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{actorName}</span>{' '}
                          <span className="text-muted-foreground">
                            {actionLabel(entry.action).toLowerCase()}
                          </span>
                          {entry.targetLabel && (
                            <>
                              {' '}
                              <span className="font-medium">
                                {entry.targetLabel}
                              </span>
                            </>
                          )}
                        </p>
                        {detail && (
                          <p className="truncate text-xs text-muted-foreground">
                            {detail}
                          </p>
                        )}
                        <p className="mt-0.5 flex items-center gap-x-2 text-[11px] text-muted-foreground">
                          <span
                            className={`inline-flex shrink-0 rounded-full px-1.5 py-0.5 font-medium ${CATEGORY_TONE[cat]}`}
                          >
                            {cat}
                          </span>
                          <span
                            className="shrink-0"
                            title={formatDistanceToNow(when, { addSuffix: true })}
                          >
                            {format(when, 'MMM d, yyyy · h:mm a')}
                          </span>
                          {entry.ip && (
                            <span className="truncate">· {entry.ip}</span>
                          )}
                        </p>
                      </div>

                      <ChevronDown
                        className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform ${
                          open ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {open && (
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-border/50 bg-muted/20 py-3 pr-4 pl-15 text-xs">
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
                        {(entry.targetType || entry.targetLabel || entry.targetId) && (
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
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => void load(logs.length, false)}
            disabled={loadingMore}
            className="border-border"
          >
            {loadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
            Load more
          </Button>
        </div>
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
        className={`min-w-0 break-words text-foreground ${
          mono ? 'font-mono text-[11px]' : ''
        }`}
      >
        {value}
      </dd>
    </>
  );
}
