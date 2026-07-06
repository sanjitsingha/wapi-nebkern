'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  BellOff,
  Bot,
  FileText,
  Megaphone,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTotalUnread } from '@/hooks/use-total-unread';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface NotificationItem {
  id: string;
  type: 'message' | 'handoff' | 'template' | 'campaign';
  title: string;
  body: string;
  at: string;
  href: string;
}

const TYPE_META: Record<
  NotificationItem['type'],
  { icon: LucideIcon; chip: string }
> = {
  message: {
    icon: MessageSquare,
    chip: 'bg-primary-soft text-primary',
  },
  handoff: {
    icon: Bot,
    chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  },
  template: {
    icon: FileText,
    chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  },
  campaign: {
    icon: Megaphone,
    chip: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
  },
};

const SEEN_KEY = 'wacrm:notifications-seen-at';
const POLL_MS = 60_000;

function loadSeenAt(): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(SEEN_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

/** Fetch the aggregated feed; null on any failure so callers keep the
 *  last list instead of flashing empty. */
async function fetchNotifications(): Promise<NotificationItem[] | null> {
  try {
    const res = await fetch('/api/notifications');
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return Array.isArray(data?.notifications) ? data.notifications : null;
  } catch {
    return null;
  }
}

/** Persist "seen up to now" and return the new marker. Module-level so
 *  the impure clock/storage access stays out of component scope. */
function persistSeenAt(): number {
  const now = Date.now();
  try {
    window.localStorage.setItem(SEEN_KEY, String(now));
  } catch {
    // Storage unavailable (private mode) — badge just won't persist.
  }
  return now;
}

/**
 * Header notification bell — WhatsApp-style.
 *
 * Badge semantics: unread-message notifications count until the chat is
 * actually read in the inbox (like WhatsApp's badge); event
 * notifications (handoffs, template verdicts, campaigns) count until
 * the bell is opened, tracked by a localStorage last-seen timestamp.
 */
export function NotificationsBell() {
  const router = useRouter();
  const totalUnread = useTotalUnread();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  // Lazy init reads localStorage once on the client. Hydration-safe
  // despite the SSR/client difference: the initial render's output
  // derives from `items`, which is always [] until the post-mount fetch.
  const [seenAt, setSeenAt] = useState<number>(loadSeenAt);
  // What "unseen" means for row highlights during THIS open — frozen
  // when the popover opens so rows don't lose their highlight the
  // instant the seen marker advances.
  const [highlightSince, setHighlightSince] = useState<number>(0);

  const refresh = useCallback(() => {
    void fetchNotifications().then((next) => {
      if (next) setItems(next);
    });
  }, []);

  // Initial load + slow poll. `totalUnread` is realtime (supabase
  // channel), so a new inbound message also re-runs this effect — a
  // fresh fetch plus a restarted interval — without waiting for the
  // poll tick.
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      void fetchNotifications().then((next) => {
        if (!cancelled && next) setItems(next);
      });
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [totalUnread]);

  const isEventUnseen = (n: NotificationItem, since: number) =>
    n.type !== 'message' && new Date(n.at).getTime() > since;

  // Messages count until read in the inbox; events count until the bell
  // is opened.
  const badgeCount =
    items.filter((n) => n.type === 'message' || isEventUnseen(n, seenAt))
      .length;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setHighlightSince(seenAt);
      setSeenAt(persistSeenAt());
      refresh();
    }
  };

  const openItem = (n: NotificationItem) => {
    setOpen(false);
    router.push(n.href);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        aria-label={
          badgeCount > 0
            ? `Notifications (${badgeCount} new)`
            : 'Notifications'
        }
        title="Notifications"
        className="text-muted-foreground hover:bg-muted hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground relative flex h-10 w-10 items-center justify-center rounded-md transition-colors focus:outline-none"
      >
        <Bell className="h-5 w-5" />
        {badgeCount > 0 && (
          <span className="bg-primary text-primary-foreground absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-95 max-w-[calc(100vw-1rem)] gap-0 overflow-hidden p-0"
      >
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <p className="text-foreground text-sm font-semibold">Notifications</p>
          {badgeCount > 0 && (
            <span className="bg-primary-soft text-primary rounded-full px-2 py-0.5 text-[11px] font-medium">
              {badgeCount} new
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <span className="bg-muted flex size-12 items-center justify-center rounded-full">
              <BellOff className="text-muted-foreground h-5 w-5" />
            </span>
            <p className="text-foreground mt-3 text-sm font-medium">
              You&apos;re all caught up
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              New messages, AI handoffs, template verdicts, and campaign
              results show up here.
            </p>
          </div>
        ) : (
          <ul className="max-h-105 overflow-y-auto py-1 scrollbar-thin">
            {items.map((n) => {
              const meta = TYPE_META[n.type];
              const fresh =
                n.type === 'message' || isEventUnseen(n, highlightSince);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={cn(
                      'hover:bg-muted/60 flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors',
                      fresh && 'bg-primary-soft/25',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                        meta.chip,
                      )}
                    >
                      <meta.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-foreground truncate text-sm font-medium">
                          {n.title}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-[11px] whitespace-nowrap">
                          {formatDistanceToNow(new Date(n.at), {
                            addSuffix: true,
                          })}
                        </span>
                      </span>
                      <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                        {n.body}
                      </span>
                    </span>
                    {fresh && (
                      <span className="bg-primary mt-2 size-1.5 shrink-0 rounded-full" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
