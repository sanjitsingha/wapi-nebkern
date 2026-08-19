'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
// Phosphor, matching the header this button sits in.
import {
  Bell,
  BellSlash,
  ChatCircleDots,
  FileText,
  Info,
  Megaphone,
  Robot,
  Trash,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useTotalUnread } from '@/hooks/use-total-unread';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface NotificationItem {
  id: string;
  type: 'message' | 'handoff' | 'template' | 'campaign' | 'announcement';
  title: string;
  body: string;
  at: string;
  href: string;
  image?: string;
}

/** True for an absolute external link (opens in a new tab). */
function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

const TYPE_META: Record<
  NotificationItem['type'],
  { icon: PhosphorIcon; chip: string }
> = {
  message: {
    icon: ChatCircleDots,
    chip: 'bg-primary-soft text-primary',
  },
  handoff: {
    icon: Robot,
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
  announcement: {
    icon: Info,
    chip: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
  },
};

const SEEN_KEY = 'wacrm:notifications-seen-at';
const DISMISSED_KEY = 'wacrm:notifications-dismissed';

/**
 * Dismissing is LOCAL, and cannot be anything else without new schema.
 *
 * This feed is assembled per request out of five source tables —
 * conversations, message_templates, broadcasts, admin_notifications —
 * and the ids (`msg-…`, `bc-…`, `ann-…`) are synthesised from those
 * rows. There is no notifications table to delete a row from. Deleting
 * the SOURCE would mean deleting somebody's conversation, or a
 * broadcast, or an announcement every tenant is reading, so "delete"
 * here means "stop showing me this", stored per device the same way
 * the seen marker already is.
 *
 * Capped because ids derive from rows that eventually age out of the
 * feed: an uncapped list would grow forever holding ids that can never
 * match anything again.
 */
const DISMISSED_CAP = 200;

function loadDismissed(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(DISMISSED_KEY) ?? '[]'
    );
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === 'string')
      : [];
  } catch {
    return [];
  }
}

function persistDismissed(ids: string[]): string[] {
  const capped = ids.slice(-DISMISSED_CAP);
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(capped));
  } catch {
    // Storage unavailable (private mode) — dismissal lasts this session.
  }
  return capped;
}

/**
 * Background refresh cadence for the feed.
 *
 * Was 45s, which cost far more than it looked: /api/notifications runs
 * five queries, and every tick also paid for auth. Eighty ticks an hour
 * per open tab, for a dropdown most people open a few times a day.
 *
 * Three things make a slow poll safe here. The message half of the
 * badge comes from `useTotalUnread`, which is realtime and instant. The
 * feed is refetched when the popover opens, which is the only moment
 * its contents are actually read. And a tab returning to the foreground
 * refetches immediately.
 */
const POLL_MS = 180_000;

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
 * One row of the feed, shared by the popover and the full-list modal.
 *
 * Extracted rather than duplicated: the two lists differ only in
 * whether a delete control sits beside the row, and keeping one copy of
 * the markup is what stops them drifting into two slightly different
 * notification designs.
 *
 * The row and the delete control are SIBLINGS, never nested — a
 * <button> inside a <button> is invalid HTML and browsers resolve it by
 * dropping the inner one.
 */
function NotificationRow({
  n,
  fresh,
  onOpen,
  onDelete,
}: {
  n: NotificationItem;
  fresh: boolean;
  onOpen: (n: NotificationItem) => void;
  /** Omitted in the popover, supplied in the modal. */
  onDelete?: (n: NotificationItem) => void;
}) {
  const meta = TYPE_META[n.type];
  return (
    <li
      className={cn(
        'hover:bg-muted/60 flex items-start transition-colors',
        fresh && 'bg-primary-soft/25'
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(n)}
        className={cn(
          'flex min-w-0 flex-1 items-start gap-3 py-2.5 pl-4 text-left',
          onDelete ? 'pr-2' : 'pr-4'
        )}
      >
        <span
          className={cn(
            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
            meta.chip
          )}
        >
          <meta.icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span
              className={cn(
                'text-foreground text-sm font-medium',
                n.type === 'announcement' ? 'wrap-break-word' : 'truncate'
              )}
            >
              {n.title}
            </span>
            <span className="text-muted-foreground shrink-0 text-[11px] whitespace-nowrap">
              {formatDistanceToNow(new Date(n.at), { addSuffix: true })}
            </span>
          </span>
          <span
            className={cn(
              'text-muted-foreground mt-0.5 block text-xs',
              n.type === 'announcement'
                ? 'wrap-break-word whitespace-pre-wrap'
                : 'truncate'
            )}
          >
            {n.body}
          </span>
          {n.type === 'announcement' && n.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={n.image}
              alt=""
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              className="border-border mt-2 h-32 w-full rounded-lg border object-cover"
            />
          )}
        </span>
        {fresh && (
          <span className="bg-primary mt-2 size-1.5 shrink-0 rounded-full" />
        )}
      </button>

      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(n)}
          aria-label={`Delete "${n.title}"`}
          title="Delete"
          className="text-muted-foreground hover:bg-muted hover:text-destructive mt-2.5 mr-2 flex size-7 shrink-0 items-center justify-center rounded-md transition-colors"
        >
          <Trash className="h-4 w-4" />
        </button>
      )}
    </li>
  );
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
  const [dismissed, setDismissed] = useState<string[]>(loadDismissed);
  // The full-list modal, opened from the popover's footer.
  const [showAll, setShowAll] = useState(false);

  const visible = useMemo(() => {
    const hidden = new Set(dismissed);
    return items.filter((n) => !hidden.has(n.id));
  }, [items, dismissed]);

  const refresh = useCallback(() => {
    void fetchNotifications().then((next) => {
      if (next) setItems(next);
    });
  }, []);

  // Initial load + slow background poll.
  //
  // Deliberately NOT keyed on `totalUnread`. It used to be, which meant
  // every inbound message tore down the interval, refetched all five
  // queries, and started a new one — so the busier the inbox, the more
  // the bell cost, exactly when the server was already busiest.
  //
  // Nothing is lost by dropping it: the badge's message count now reads
  // `totalUnread` directly (see badgeCount below), which is realtime, so
  // it still moves the instant a message arrives. This feed only
  // supplies the popover's CONTENTS, and those are refetched when the
  // popover opens — the one moment anybody reads them.
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      void fetchNotifications().then((next) => {
        if (!cancelled && next) setItems(next);
      });
    load();

    // A hidden tab has nobody looking at it. Skip the tick rather than
    // paying for a feed nobody can see; the visibility handler below
    // catches it up the moment the tab comes back.
    const tick = () => {
      if (document.visibilityState === 'visible') load();
    };
    const t = setInterval(tick, POLL_MS);

    // Refetch when the user returns to the tab — so an announcement sent
    // from the admin panel (a different tab) shows up immediately instead
    // of waiting for the next poll tick.
    const onFocus = () => {
      if (document.visibilityState === 'visible') load();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  const isEventUnseen = (n: NotificationItem, since: number) =>
    n.type !== 'message' && new Date(n.at).getTime() > since;

  // Messages count until read in the inbox; events count until the bell
  // is opened.
  //
  // The message half comes from `totalUnread` rather than from the
  // fetched feed. Both report the same thing — conversations with
  // unread inbound messages — but `totalUnread` rides the Realtime
  // channel, so the badge moves the instant a message lands. It used to
  // be read off `items`, which meant the only way to keep the badge
  // live was to refetch the whole five-query feed on every inbound
  // message. This is both cheaper and faster.
  // Counts `visible`, so dismissing an event notification also clears it
  // from the badge. The message half rides `totalUnread` and is
  // deliberately NOT reduced by dismissing: the chat is still unread,
  // and the badge should not claim otherwise because the row was hidden.
  const badgeCount =
    totalUnread + visible.filter((n) => isEventUnseen(n, seenAt)).length;

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
    if (!n.href) return; // announcement with no link — just dismiss
    if (isExternal(n.href)) {
      window.open(n.href, '_blank', 'noopener,noreferrer');
    } else {
      router.push(n.href);
    }
  };

  // The popover closes first: a dialog opened from inside it would be
  // unmounted the moment the popover dismisses, and two overlapping
  // focus traps fight each other regardless.
  const viewAll = () => {
    setOpen(false);
    setShowAll(true);
  };

  const dismiss = (n: NotificationItem) => {
    setDismissed((prev) =>
      prev.includes(n.id) ? prev : persistDismissed([...prev, n.id])
    );
  };

  return (
    <>
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
            <p className="text-foreground text-sm font-semibold">
              Notifications
            </p>
            {badgeCount > 0 && (
              <span className="bg-primary-soft text-primary rounded-full px-2 py-0.5 text-[11px] font-medium">
                {badgeCount} new
              </span>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <span className="bg-muted flex size-12 items-center justify-center rounded-full">
                <BellSlash className="text-muted-foreground h-5 w-5" />
              </span>
              <p className="text-foreground mt-3 text-sm font-medium">
                You&apos;re all caught up
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                New messages, AI handoffs, template verdicts, campaign results,
                and announcements show up here.
              </p>
            </div>
          ) : (
            <ul className="max-h-105 scrollbar-thin overflow-y-auto py-1">
              {visible.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  fresh={
                    n.type === 'message' || isEventUnseen(n, highlightSince)
                  }
                  onOpen={openItem}
                />
              ))}
            </ul>
          )}

          {visible.length > 0 && (
            <div className="border-border border-t">
              <button
                type="button"
                onClick={viewAll}
                className="text-primary hover:bg-muted/60 w-full px-4 py-2.5 text-center text-xs font-medium transition-colors"
              >
                View all notifications
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Rendered outside the Popover on purpose — see viewAll(). */}
      <Dialog
        open={showAll}
        onOpenChange={(next) => {
          if (!next) setShowAll(false);
        }}
      >
        <DialogContent className="border-border bg-popover text-popover-foreground gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-border border-b px-4 py-3">
            <DialogTitle className="text-sm">Notifications</DialogTitle>
            <DialogDescription className="text-xs">
              {/* Says where deleting applies. Without this the button
                  reads like a server-side delete, which it is not. */}
              Deleting removes a notification from this device only — it does
              not touch the message, campaign, or announcement behind it.
            </DialogDescription>
          </DialogHeader>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <span className="bg-muted flex size-12 items-center justify-center rounded-full">
                <BellSlash className="text-muted-foreground h-5 w-5" />
              </span>
              <p className="text-foreground mt-3 text-sm font-medium">
                Nothing left here
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                New notifications will show up as they arrive.
              </p>
            </div>
          ) : (
            <ul className="max-h-[60vh] scrollbar-thin overflow-y-auto py-1">
              {visible.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  // Highlighting is a popover affordance for "new since
                  // you last looked". In a deliberate full list it is
                  // just noise, so every row reads the same.
                  fresh={false}
                  onOpen={(item) => {
                    setShowAll(false);
                    openItem(item);
                  }}
                  onDelete={dismiss}
                />
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
