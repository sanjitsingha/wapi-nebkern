'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ArrowUpRight,
  X,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { isExternalLink } from '@/lib/app-popup';
import type {
  AppAnnouncement,
  AnnouncementVariant,
} from '@/lib/app-announcement';

const DISMISS_PREFIX = 'wacrm:announcement-dismissed:';

function isDismissed(id: string): boolean {
  try {
    return localStorage.getItem(DISMISS_PREFIX + id) === '1';
  } catch {
    return false;
  }
}

function markDismissed(id: string) {
  try {
    localStorage.setItem(DISMISS_PREFIX + id, '1');
  } catch {
    // Storage unavailable (private mode) — it'll just show again next load.
  }
}

// Severity styling. Colours lean on theme tokens where possible and on
// fixed hues (amber/emerald) where there's no token, each with a dark
// variant so the bar stays legible in both themes.
const VARIANT_STYLES: Record<
  AnnouncementVariant,
  { bar: string; icon: LucideIcon; iconColor: string; link: string }
> = {
  info: {
    bar: 'bg-primary-soft border-primary/20',
    icon: Info,
    iconColor: 'text-primary',
    link: 'text-primary hover:opacity-80',
  },
  success: {
    bar: 'bg-emerald-500/10 border-emerald-500/20',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    link: 'text-emerald-700 hover:opacity-80 dark:text-emerald-400',
  },
  warning: {
    bar: 'bg-amber-500/10 border-amber-500/25',
    icon: AlertTriangle,
    iconColor: 'text-amber-600 dark:text-amber-400',
    link: 'text-amber-700 hover:opacity-80 dark:text-amber-400',
  },
  critical: {
    bar: 'bg-destructive/10 border-destructive/25',
    icon: AlertOctagon,
    iconColor: 'text-destructive',
    link: 'text-destructive hover:opacity-80',
  },
};

/**
 * Admin-managed announcement bar, shown directly under the dashboard
 * navbar. Fetches the newest live announcement for this account and
 * renders it with severity-based styling (info / success / warning /
 * critical), an optional CTA link, and a dismiss control when the
 * announcement is dismissible. Dismissal is remembered per-id in
 * localStorage so it doesn't reappear on every load.
 */
export function AnnouncementBar() {
  const [announcement, setAnnouncement] = useState<AppAnnouncement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/account/announcement')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const a: AppAnnouncement | null = data?.announcement ?? null;
        if (cancelled || !a) return;
        if (a.dismissible && isDismissed(a.id)) return;
        setAnnouncement(a);
      })
      .catch(() => {
        /* no bar on failure */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!announcement) return null;

  const styles = VARIANT_STYLES[announcement.variant];
  const Icon = styles.icon;
  const link = announcement.linkUrl;
  const linkLabel = announcement.linkLabel?.trim() || 'Learn more';

  const dismiss = () => {
    markDismissed(announcement.id);
    setAnnouncement(null);
  };

  return (
    <div
      className={cn(
        'text-foreground flex items-center gap-3 border-b px-4 py-2 text-sm sm:px-6',
        styles.bar,
      )}
    >
      <Icon className={cn('size-4 shrink-0', styles.iconColor)} />
      <p className="min-w-0 flex-1 truncate sm:whitespace-normal">
        {announcement.message}
      </p>

      {link &&
        (isExternalLink(link) ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex shrink-0 items-center gap-1 font-medium',
              styles.link,
            )}
          >
            {linkLabel}
            <ArrowUpRight className="size-3.5" />
          </a>
        ) : (
          <Link
            href={link}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 font-medium',
              styles.link,
            )}
          >
            {linkLabel}
            <ArrowUpRight className="size-3.5" />
          </Link>
        ))}

      {announcement.dismissible && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="text-muted-foreground hover:text-foreground hover:bg-foreground/5 shrink-0 rounded-md p-1 transition-colors"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
