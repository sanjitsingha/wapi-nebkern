'use client';

import { useState } from 'react';
import {
  Bot,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  Hourglass,
  Info,
  ListFilter,
  MailOpen,
  Sparkles,
  Tag as TagIcon,
  Timer,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PersonAvatar } from '@/components/ui/person-avatar';
import {
  EMPTY_FILTERS,
  activeCount,
  isActive,
  type DateCondition,
  type DatePreset,
  type FilterKey,
  type InboxFilters,
} from '@/lib/inbox/filters';

// ============================================================
// The inbox list's one filter button. A menu of conditions — Labels,
// Open status, Read status, Awaiting response, Assigned to, Created at,
// Last active, Reply window — each opening its own options, matched
// ALL or ANY (the header's toggle). Applies as you pick; a green dot
// marks each condition in use, and the button counts them.
// ============================================================

type ListKey = Exclude<FilterKey, 'created' | 'lastActive'>;

const CATEGORIES: { key: FilterKey; label: string; icon: LucideIcon }[] = [
  { key: 'tags', label: 'Labels', icon: TagIcon },
  { key: 'statuses', label: 'Open status', icon: CircleDot },
  { key: 'read', label: 'Read status', icon: MailOpen },
  { key: 'awaiting', label: 'Awaiting response', icon: Hourglass },
  { key: 'assignees', label: 'Assigned to', icon: UserRound },
  { key: 'created', label: 'Created at', icon: CalendarPlus },
  { key: 'lastActive', label: 'Last active', icon: Clock },
  { key: 'window', label: 'Reply window', icon: Timer },
];

const FIXED_OPTIONS: Partial<Record<ListKey, { value: string; label: string }[]>> = {
  statuses: [
    { value: 'open', label: 'Open' },
    { value: 'pending', label: 'Pending' },
    { value: 'closed', label: 'Closed' },
  ],
  read: [
    { value: 'unread', label: 'Unread' },
    { value: 'read', label: 'Read' },
  ],
  awaiting: [
    { value: 'us', label: 'Customer is waiting for us' },
    { value: 'customer', label: 'We replied last' },
  ],
  window: [
    { value: 'open', label: 'Open — reply freely' },
    { value: 'closed', label: 'Closed — templates only' },
  ],
};

const DATE_PRESETS: { value: DatePreset | null; label: string }[] = [
  { value: null, label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
];

function CheckRow({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onClick}
      className="hover:bg-muted flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm"
    >
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded border',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
        )}
      >
        {checked && <Check className="size-3" />}
      </span>
      <span className="text-foreground flex min-w-0 flex-1 items-center gap-2">{children}</span>
    </button>
  );
}

export function InboxFilterMenu({
  filters,
  onChange,
  tags,
  members,
}: {
  filters: InboxFilters;
  onChange: (next: InboxFilters) => void;
  tags: { id: string; name: string; color: string }[];
  members: { userId: string; name: string; avatarUrl: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<FilterKey | null>(null);
  const count = activeCount(filters);
  const category = CATEGORIES.find((c) => c.key === view) ?? null;

  const toggle = (key: ListKey, value: string) => {
    const current = filters[key] as string[];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: next });
  };

  const clear = (key: FilterKey) =>
    onChange({ ...filters, [key]: EMPTY_FILTERS[key] });

  const listOptions = (key: ListKey) => {
    const picked = filters[key] as string[];
    if (key === 'tags') {
      return tags.length === 0 ? (
        <p className="text-muted-foreground px-3 py-4 text-center text-xs">No labels yet.</p>
      ) : (
        tags.map((t) => (
          <CheckRow key={t.id} checked={picked.includes(t.id)} onClick={() => toggle(key, t.id)}>
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
            <span className="truncate">{t.name}</span>
          </CheckRow>
        ))
      );
    }
    if (key === 'assignees') {
      return (
        <>
          <CheckRow checked={picked.includes('unassigned')} onClick={() => toggle(key, 'unassigned')}>
            <UserRound className="text-muted-foreground size-4" />
            Unassigned
          </CheckRow>
          <CheckRow checked={picked.includes('ai')} onClick={() => toggle(key, 'ai')}>
            <Sparkles className="text-primary size-4" />
            Maya (AI)
          </CheckRow>
          <CheckRow checked={picked.includes('bot')} onClick={() => toggle(key, 'bot')}>
            <Bot className="text-muted-foreground size-4" />
            Bot
          </CheckRow>
          {members.map((m) => (
            <CheckRow
              key={m.userId}
              checked={picked.includes(`user:${m.userId}`)}
              onClick={() => toggle(key, `user:${m.userId}`)}
            >
              <PersonAvatar name={m.name} avatarUrl={m.avatarUrl} className="size-4 text-[8px]" />
              <span className="truncate">{m.name}</span>
            </CheckRow>
          ))}
        </>
      );
    }
    return (FIXED_OPTIONS[key] ?? []).map((o) => (
      <CheckRow key={o.value} checked={picked.includes(o.value)} onClick={() => toggle(key, o.value)}>
        {o.label}
      </CheckRow>
    ));
  };

  const dateOptions = (key: 'created' | 'lastActive') => {
    const current = filters[key];
    const set = (next: DateCondition | null) => onChange({ ...filters, [key]: next });
    return (
      <>
        {DATE_PRESETS.map((p) => {
          const checked = (current?.preset ?? null) === p.value;
          return (
            <button
              key={p.label}
              type="button"
              role="menuitemradio"
              aria-checked={checked}
              onClick={() =>
                set(p.value === null ? null : p.value === 'custom' ? { preset: 'custom', from: current?.from, to: current?.to } : { preset: p.value })
              }
              className="hover:bg-muted flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm"
            >
              <span
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-full border',
                  checked ? 'border-primary' : 'border-border',
                )}
              >
                {checked && <span className="bg-primary size-2 rounded-full" />}
              </span>
              <span className="text-foreground">{p.label}</span>
            </button>
          );
        })}
        {current?.preset === 'custom' && (
          <div className="grid grid-cols-2 gap-2 px-3 pt-1 pb-2">
            <label className="text-muted-foreground space-y-1 text-[11px]">
              From
              <input
                type="date"
                value={current.from ?? ''}
                max={current.to || undefined}
                onChange={(e) => set({ ...current, from: e.target.value || undefined })}
                className="border-border bg-background text-foreground h-8 w-full rounded-md border px-2 text-xs"
              />
            </label>
            <label className="text-muted-foreground space-y-1 text-[11px]">
              To
              <input
                type="date"
                value={current.to ?? ''}
                min={current.from || undefined}
                onChange={(e) => set({ ...current, to: e.target.value || undefined })}
                className="border-border bg-background text-foreground h-8 w-full rounded-md border px-2 text-xs"
              />
            </label>
          </div>
        )}
      </>
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setView(null);
      }}
    >
      <PopoverTrigger
        title="Filter conversations"
        aria-label="Filter conversations"
        className={cn(
          'relative inline-flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors',
          count > 0
            ? 'border-primary/30 bg-primary-soft text-primary'
            : 'border-border bg-muted text-muted-foreground hover:text-foreground',
        )}
      >
        <ListFilter className="size-4" />
        {count > 0 && (
          <span className="bg-primary text-primary-foreground absolute -top-1.5 -right-1.5 inline-flex size-4 items-center justify-center rounded-full text-[10px] font-semibold">
            {count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-64 gap-0 p-0">
        {!category ? (
          <>
            <div className="border-border flex items-center justify-between border-b px-3 py-2.5">
              <span className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
                Filter condition
                <span title="ALL: a chat must match every condition. ANY: one is enough.">
                  <Info className="text-muted-foreground size-3.5" />
                </span>
              </span>
              <button
                type="button"
                onClick={() => onChange({ ...filters, match: filters.match === 'all' ? 'any' : 'all' })}
                title="Match all conditions, or any one"
                className="border-border text-muted-foreground hover:text-foreground rounded-md border px-2 py-0.5 text-[11px] font-semibold"
              >
                {filters.match.toUpperCase()}
              </button>
            </div>
            <ul className="py-1">
              {CATEGORIES.map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={() => setView(c.key)}
                    className="hover:bg-muted flex w-full items-center gap-3 px-3 py-2 text-left text-sm"
                  >
                    <c.icon className="text-muted-foreground size-4 shrink-0" />
                    <span className="text-foreground flex-1">{c.label}</span>
                    {isActive(filters, c.key) && (
                      <span className="size-2 rounded-full bg-emerald-500" aria-label="In use" />
                    )}
                    <ChevronRight className="text-muted-foreground size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            {count > 0 && (
              <div className="border-border border-t px-3 py-2">
                <button
                  type="button"
                  onClick={() => onChange({ ...EMPTY_FILTERS, match: filters.match })}
                  className="text-primary text-xs font-medium hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="border-border flex items-center gap-1 border-b px-1.5 py-1.5">
              <button
                type="button"
                onClick={() => setView(null)}
                aria-label="Back"
                className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-7 items-center justify-center rounded-md"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-foreground flex-1 text-sm font-semibold">{category.label}</span>
              {isActive(filters, category.key) && (
                <button
                  type="button"
                  onClick={() => clear(category.key)}
                  className="text-primary px-2 text-xs font-medium hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {category.key === 'created' || category.key === 'lastActive'
                ? dateOptions(category.key)
                : listOptions(category.key as ListKey)}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
