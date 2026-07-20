'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  WALKTHROUGH_STEPS,
  type StepPlacement,
  type WalkthroughStep,
} from '@/lib/walkthrough/steps';

// Gap between the highlighted element and the tooltip, and how far the
// spotlight ring is inflated beyond the element's own box.
const TOOLTIP_GAP = 14;
const SPOTLIGHT_PAD = 6;
const TOOLTIP_W = 320;
// Keep the card clear of the viewport edges on small screens.
const VIEWPORT_MARGIN = 12;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Shrink a rect to the part actually on screen: intersect it with every
 * clipping ancestor, then with the viewport.
 *
 * This matters because the sidebar collapses by keeping its nav at the
 * full 256px and letting the <aside> clip it with overflow-hidden — so
 * a collapsed nav row still *reports* 256px even though only 64px is
 * visible. Spotlighting the raw rect would draw a ring straight across
 * the main content. The viewport pass covers the mobile drawer, which
 * hides by translating off-screen rather than by clipping.
 */
function clipRect(el: HTMLElement, r: DOMRect): Rect | null {
  let left = r.left;
  let top = r.top;
  let right = r.right;
  let bottom = r.bottom;

  for (
    let node = el.parentElement;
    node && node !== document.body;
    node = node.parentElement
  ) {
    const s = getComputedStyle(node);
    const clips =
      s.overflow !== 'visible' ||
      s.overflowX !== 'visible' ||
      s.overflowY !== 'visible';
    if (!clips) continue;
    const c = node.getBoundingClientRect();
    left = Math.max(left, c.left);
    top = Math.max(top, c.top);
    right = Math.min(right, c.right);
    bottom = Math.min(bottom, c.bottom);
  }

  left = Math.max(left, 0);
  top = Math.max(top, 0);
  right = Math.min(right, window.innerWidth);
  bottom = Math.min(bottom, window.innerHeight);

  const width = right - left;
  const height = bottom - top;
  // Fully clipped or off-screen — the caller falls back to a centred
  // card rather than ringing something nobody can see.
  if (width <= 1 || height <= 1) return null;
  return { top, left, width, height };
}

/**
 * Locate a step's anchor. Returns null when the step is unanchored, the
 * element isn't mounted, or it isn't visibly on screen — all of which
 * fall back to a centred card rather than pointing at nothing.
 */
function resolveTarget(step: WalkthroughStep): Rect | null {
  if (!step.target) return null;
  const el = document.querySelector<HTMLElement>(
    `[data-walkthrough="${step.target}"]`,
  );
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return clipRect(el, r);
}

/**
 * Place the tooltip beside the spotlight, flipping to the opposite side
 * when the preferred one would overflow, then clamping into the
 * viewport. Runs against viewport coordinates because the overlay is
 * `position: fixed`.
 */
function placeTooltip(
  rect: Rect | null,
  placement: StepPlacement,
  tooltipH: number,
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!rect) {
    return {
      top: Math.max(VIEWPORT_MARGIN, (vh - tooltipH) / 2),
      left: Math.max(VIEWPORT_MARGIN, (vw - TOOLTIP_W) / 2),
    };
  }

  const fits: Record<StepPlacement, boolean> = {
    right: rect.left + rect.width + TOOLTIP_GAP + TOOLTIP_W < vw,
    left: rect.left - TOOLTIP_GAP - TOOLTIP_W > 0,
    bottom: rect.top + rect.height + TOOLTIP_GAP + tooltipH < vh,
    top: rect.top - TOOLTIP_GAP - tooltipH > 0,
  };
  const opposite: Record<StepPlacement, StepPlacement> = {
    right: 'left',
    left: 'right',
    top: 'bottom',
    bottom: 'top',
  };

  // Preferred side, else its mirror, else whichever side has room.
  let side: StepPlacement = placement;
  if (!fits[side]) {
    side = fits[opposite[side]]
      ? opposite[side]
      : ((Object.keys(fits) as StepPlacement[]).find((s) => fits[s]) ?? placement);
  }

  let top: number;
  let left: number;
  switch (side) {
    case 'right':
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.left + rect.width + TOOLTIP_GAP;
      break;
    case 'left':
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.left - TOOLTIP_GAP - TOOLTIP_W;
      break;
    case 'bottom':
      top = rect.top + rect.height + TOOLTIP_GAP;
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      break;
    default:
      top = rect.top - TOOLTIP_GAP - tooltipH;
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      break;
  }

  return {
    top: Math.min(Math.max(VIEWPORT_MARGIN, top), vh - tooltipH - VIEWPORT_MARGIN),
    left: Math.min(Math.max(VIEWPORT_MARGIN, left), vw - TOOLTIP_W - VIEWPORT_MARGIN),
  };
}

interface WalkthroughOverlayProps {
  stepIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onFinish: () => void;
}

export function WalkthroughOverlay({
  stepIndex,
  onNext,
  onPrev,
  onFinish,
}: WalkthroughOverlayProps) {
  const step = WALKTHROUGH_STEPS[stepIndex];
  const [rect, setRect] = useState<Rect | null>(null);
  const [tooltipH, setTooltipH] = useState(180);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === WALKTHROUGH_STEPS.length - 1;

  // No SSR guard needed for the portal: the provider only renders this
  // component once stepIndex is non-null, which can only happen from a
  // client-side start() or the auto-start effect. document.body is
  // therefore always present by the time we mount.

  // Measure before paint so the spotlight never renders at a stale
  // position for a frame when moving between steps. Reading layout of
  // an element we don't own is exactly the "synchronise with an
  // external system" case effects are for — there's no render-time
  // equivalent, hence the suppression.
  useLayoutEffect(() => {
    if (!step) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRect(resolveTarget(step));
  }, [step]);

  // The anchors live in a fixed sidebar/header, but a resize (or the
  // sidebar collapsing) moves them — re-measure rather than letting the
  // ring drift off the element.
  useEffect(() => {
    if (!step) return;
    const remeasure = () => setRect(resolveTarget(step));
    window.addEventListener('resize', remeasure);
    window.addEventListener('scroll', remeasure, true);
    return () => {
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('scroll', remeasure, true);
    };
  }, [step]);

  const measureTooltip = useCallback((node: HTMLDivElement | null) => {
    if (node) setTooltipH(node.getBoundingClientRect().height);
  }, []);

  // Arrow keys and Escape — a tour is a linear thing, so it should
  // drive from the keyboard without reaching for the mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFinish();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') onNext();
      else if (e.key === 'ArrowLeft' && !isFirst) onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNext, onPrev, onFinish, isFirst]);

  if (!step) return null;

  const pos = placeTooltip(rect, step.placement ?? 'right', tooltipH);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="walkthrough-title"
      className="fixed inset-0 z-[100]"
    >
      {/*
        The dimmer is drawn as a single element with a huge spread
        box-shadow rather than four rects around the target: the shadow
        fills the entire viewport while the element's own box stays
        clear, giving a real cutout that animates smoothly between
        steps. `pointer-events-none` lets the underlying UI stay
        visually live; clicks are caught by the backdrop below it.
      */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary/70 transition-all duration-300 ease-out"
          style={{
            top: rect.top - SPOTLIGHT_PAD,
            left: rect.left - SPOTLIGHT_PAD,
            width: rect.width + SPOTLIGHT_PAD * 2,
            height: rect.height + SPOTLIGHT_PAD * 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-black/60" />
      )}

      {/* Click-catcher. Clicking outside the card advances rather than
          closing — dismissing a tour by mis-clicking is a bad surprise;
          the explicit Skip control is how you leave. */}
      <button
        type="button"
        aria-label="Next step"
        tabIndex={-1}
        onClick={onNext}
        className="absolute inset-0 cursor-default"
      />

      <div
        ref={measureTooltip}
        style={{ top: pos.top, left: pos.left, width: TOOLTIP_W }}
        className={cn(
          'absolute rounded-xl border border-border bg-card p-4 shadow-2xl',
          'transition-[top,left] duration-300 ease-out',
        )}
      >
        <button
          type="button"
          onClick={onFinish}
          aria-label="Skip walkthrough"
          className="absolute top-3 right-3 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <h3
          id="walkthrough-title"
          className="pr-6 text-[15px] font-semibold text-foreground"
        >
          {step.title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-hidden>
            {WALKTHROUGH_STEPS.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === stepIndex ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30',
                )}
              />
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={onPrev}
                className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={isLast ? onFinish : onNext}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>

        {!isLast && (
          <button
            type="button"
            onClick={onFinish}
            className="mt-2 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            Skip tour
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
