'use client';

import Link from 'next/link';
import { ArrowUpRight, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { BrandLogo } from '@/components/brand/logo';
import type { Integration } from './integrations-catalog';

// The pieces an integration page and its dialogs share: the tool's mark,
// the two-way arrows, and the "connect" hero built from them.

export function ToolMark({ item, size = 'lg' }: { item: Integration; size?: 'lg' | 'sm' }) {
  if (item.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.logo}
        alt={item.name}
        className={cn('w-auto object-contain', size === 'lg' ? 'h-10' : 'h-8')}
      />
    );
  }
  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-lg',
        size === 'lg' ? 'size-10' : 'size-9',
        item.tone,
      )}
    >
      <item.icon className="size-5" />
    </span>
  );
}

/** Two arrows chasing each other round a loop: data both ways. */
export function SyncArrows({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 34"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M88 17 A12 12 0 0 0 76 5 H14" />
      <path d="M18 2 L14 5 L18 8" />
      <path d="M12 17 A12 12 0 0 0 24 29 H86" />
      <path d="M82 26 L86 29 L82 32" />
    </svg>
  );
}

export function ConnectHero({
  item,
  label,
  onConnect,
  href,
  loading = false,
  disabled = false,
  note,
}: {
  item: Integration;
  label: string;
  /** Either opens a dialog… */
  onConnect?: () => void;
  /** …or goes somewhere (the setup guide), in a new tab. */
  href?: string;
  loading?: boolean;
  /** Not available here (e.g. not configured on the server). */
  disabled?: boolean;
  note?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-14 text-center">
      <p className="text-sm font-medium text-muted-foreground">
        Connect {item.name}
      </p>

      <div className="mt-6 flex items-center gap-5 sm:gap-8">
        {/* The lockup spells "instant" itself, so no caption under it. */}
        <BrandLogo className="h-7" />
        <SyncArrows className="h-8 w-24 shrink-0 text-muted-foreground/60" />
        <div className="flex flex-col items-center gap-2">
          <ToolMark item={item} />
          <span className="text-sm font-medium text-foreground">{item.name}</span>
        </div>
      </div>

      {href ? (
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants(), 'mt-8 h-9 px-4')}
        >
          {label}
          <ArrowUpRight className="size-4" />
        </Link>
      ) : (
        <Button onClick={onConnect} disabled={loading || disabled} className="mt-8 h-9 px-4">
          {loading ? <Loader2 className="size-4 animate-spin" /> : label}
        </Button>
      )}

      {note && (
        <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  );
}
