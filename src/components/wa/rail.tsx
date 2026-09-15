'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { waType } from './ui';

// ============================================================
// A horizontal card rail for the WhatsApp-design landing page — a
// heading with prev/next arrows, and a row of cards you scroll sideways.
//
// Shared by the features carousel and the recent-posts row so the two
// scroll, snap and line up identically. The rail owns layout and
// scrolling; callers own the cards, and size them — each card sets its
// own width to decide how many show at once. Every card must carry
// `data-card`, which is what the arrows measure to step one card.
//
// LAYOUT
//
// The rail starts on the page's content edge (the same 1232px column as
// the hero) but runs off the right edge of the screen, so the card cut
// by the edge tells people there is more to scroll. Cards snap to that
// same left edge.
//
// Client component only for the arrow buttons: they need the rail's
// scroll position to know when to disable themselves. Scrolling by
// trackpad, touch or keyboard works without them. The cards themselves
// arrive as children, so they can still be rendered on the server.
// ============================================================

/* The gutter that lines the rail up with the page's 1232px content
   column: half of whatever the viewport has beyond 1232px, never less
   than the section's 24px side padding. As a percentage of the
   full-width rail, so it ignores the scrollbar (100vw would not). */
const GUTTER =
  'ps-[max(1.5rem,calc((100%_-_1232px)/2))] pe-[max(1.5rem,calc((100%_-_1232px)/2))] scroll-ps-[max(1.5rem,calc((100%_-_1232px)/2))]';

export function WaRail({
  id,
  label,
  title,
  subtitle,
  className,
  children,
}: {
  /** Section id, for in-page links like /#features. */
  id?: string;
  /** Extra classes for the section, e.g. its background. */
  className?: string;
  /** Accessible name for the scrollable region. */
  label: string;
  /** A node, not just a string, so a caller can place a line break. */
  title: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const update = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    // A couple of pixels of slack: snapping and sub-pixel widths rarely
    // land exactly on 0 or on the maximum.
    setCanPrev(rail.scrollLeft > 2);
    setCanNext(rail.scrollLeft < rail.scrollWidth - rail.clientWidth - 2);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    update();
    rail.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(rail);
    return () => {
      rail.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [update]);

  /** One card plus the gap per click, so a card always lands on the
   *  snap edge rather than part of a card along. */
  const step = (direction: 1 | -1) => {
    const rail = railRef.current;
    const card = rail?.querySelector<HTMLElement>('[data-card]');
    if (!rail || !card) return;
    const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
    rail.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: 'smooth' });
  };

  return (
    <section id={id} className={cn('scroll-mt-24 py-20 sm:py-24', className)}>
      <div className="mx-auto flex max-w-[1232px] flex-col gap-8 px-6 sm:flex-row sm:items-end sm:justify-between">
        {/* Wide enough for a long title to sit on two lines at full size;
            the subtitle keeps its own shorter measure. */}
        <div className="max-w-[900px]">
          <h2 className={cn(waType.displayLg, 'text-balance')}>{title}</h2>
          {subtitle && (
            <p className={cn(waType.bodyLg, 'mt-6 max-w-[640px] text-pretty text-(--wa-ink-muted)')}>
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-3">
          <ArrowButton label="Previous" disabled={!canPrev} onClick={() => step(-1)}>
            <ChevronLeft className="size-5" />
          </ArrowButton>
          <ArrowButton label="Next" disabled={!canNext} onClick={() => step(1)}>
            <ChevronRight className="size-5" />
          </ArrowButton>
        </div>
      </div>

      <div
        ref={railRef}
        role="region"
        aria-label={label}
        tabIndex={0}
        className={cn(
          'mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 outline-none',
          // No visible scrollbar — the arrows and the cut-off card at the
          // edge say it scrolls.
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          GUTTER,
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** The spec's secondary button, as a circle: transparent with an ink
 *  hairline, filling ink on hover. */
function ArrowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-11 items-center justify-center rounded-full border border-(--wa-ink) text-(--wa-ink) transition-colors hover:bg-(--wa-ink) hover:text-(--wa-canvas) disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
