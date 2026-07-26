import type { CSSProperties } from 'react';

import { cn } from '@/lib/utils';

// ============================================================
// /lp-2 decorative primitives.
//
// The joyful look is built from a small vocabulary repeated at
// different sizes and hues — a highlight box, a squiggle, a sparkle, a
// blurred blob, a dotted field. Keeping them here (rather than inline
// in each section) is what stops the page drifting into five different
// hand-drawn styles as sections get added.
//
// Every export is a plain server component: pure SVG/markup, no state.
// ============================================================

/** Any of the palette hues, passed as the CSS var name from lp2.css. */
export type Lp2Hue =
  | 'lemon'
  | 'coral'
  | 'sky'
  | 'grape'
  | 'tangerine'
  | 'pop'
  | 'mint'
  | 'grass';

const hue = (h: Lp2Hue) => `var(--lp2-${h})`;

/* ─── Highlight ───────────────────────────────────────────────────── */

/**
 * A word with a solid highlighter block behind it — the page's way of
 * marking the key word in a headline.
 *
 * `whitespace-nowrap` keeps the highlighted phrase on one line, so the
 * box frames one continuous run rather than breaking into two boxes
 * mid-phrase.
 *
 * The block is drawn first (absolute) and the text painted over it
 * (relative, later in the DOM), so no z-index juggling is needed. It
 * bleeds a little past the word on each side the way a marker swipe
 * overshoots, and everything is sized in `em` so it tracks the
 * headline's font-size at every breakpoint.
 */
export function Highlight({
  children,
  color = 'lemon',
  className,
}: {
  children: React.ReactNode;
  color?: Lp2Hue;
  className?: string;
}) {
  return (
    <span className={cn('relative inline-block whitespace-nowrap', className)}>
      {/* Sharp-cornered block with the ink outline AND the hard offset
          shadow the stickers and screens carry — the site's signature
          "stuck-on" look, not a flat outline. It slightly overshoots
          the word so the frame clears the glyphs. */}
      <span
        aria-hidden
        className="absolute inset-x-[-0.12em] inset-y-[-0.04em] border-2 border-(--lp2-ink) shadow-(--lp2-shadow)"
        style={{ backgroundColor: hue(color) }}
      />
      <span className="relative">{children}</span>
    </span>
  );
}

/* ─── Squiggle ────────────────────────────────────────────────────── */

/** A short wavy stroke — confetti for the corners of a section. */
export function Squiggle({
  color = 'coral',
  className,
  style,
}: {
  color?: Lp2Hue;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 64 20"
      className={cn('pointer-events-none', className)}
      style={style}
    >
      <path
        d="M2 14C8 2 16 2 22 10s14 8 20 0 12-8 20-2"
        fill="none"
        stroke={hue(color)}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ─── Sparkle ─────────────────────────────────────────────────────── */

/** Four-point star. The concave curves are what keep it a "sparkle"
 *  rather than a rating star. */
export function Sparkle({
  color = 'lemon',
  className,
  style,
}: {
  color?: Lp2Hue;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={cn('pointer-events-none', className)}
      style={style}
    >
      <path
        d="M12 0c1.1 8.3 3.7 11 12 12-8.3 1-11 3.7-12 12-1-8.3-3.7-11-12-12C8.3 11 11 8.3 12 0Z"
        fill={hue(color)}
        stroke="var(--lp2-ink)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Background blob ─────────────────────────────────────────────── */

/**
 * A big, heavily blurred wash of colour behind the content. Several of
 * these overlapping are what give the cream canvas its depth — without
 * them the page is flat paper with stickers on it.
 *
 * Always `aria-hidden` + `pointer-events-none`: they routinely overlap
 * live text and links.
 */
export function Blob({
  color = 'mint',
  className,
  style,
}: {
  color?: Lp2Hue;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'lp2-drift pointer-events-none absolute rounded-full blur-3xl',
        className,
      )}
      style={{ backgroundColor: hue(color), ...style }}
    />
  );
}

/* ─── Dotted field ────────────────────────────────────────────────── */

/**
 * Faint dot grid, masked so it fades out before it reaches the edges.
 * Grounds the floating stickers — pure cream gives them nothing to
 * float *over*.
 */
export function DotField({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        backgroundImage:
          'radial-gradient(circle, rgba(25,24,38,0.13) 1.5px, transparent 1.5px)',
        backgroundSize: '26px 26px',
        maskImage:
          'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 78%)',
        WebkitMaskImage:
          'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 78%)',
      }}
    />
  );
}

/* ─── Sticker ─────────────────────────────────────────────────────── */

/**
 * The page's signature unit: a small rounded card with a 2px ink
 * outline and a hard offset shadow, tilted a few degrees.
 *
 * The tilt goes through `--lp2-tilt` rather than a `rotate-` utility so
 * the float keyframe can re-apply it on every frame — `transform` is a
 * single property, and a keyframe animating `translateY` alone would
 * otherwise flatten the rotation to zero for the whole animation.
 */
export function Sticker({
  children,
  color = 'lemon',
  tilt = -4,
  float = false,
  className,
}: {
  children: React.ReactNode;
  color?: Lp2Hue;
  /** Degrees; negative leans left. Keep under ~8 — past that it stops
   *  reading as "stuck on at a jaunty angle" and starts reading as
   *  broken layout. */
  tilt?: number;
  float?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-2xl border-2 border-(--lp2-ink) px-3.5 py-2 text-sm font-bold shadow-(--lp2-shadow-sm)',
        float && 'lp2-float',
        className,
      )}
      style={
        {
          backgroundColor: hue(color),
          '--lp2-tilt': `${tilt}deg`,
          transform: `rotate(${tilt}deg)`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

/* ─── Avatar stack ────────────────────────────────────────────────── */

// Initials + a colour each, because there are no photos in `public/`
// yet (hero-avatars/ is a README and nothing else). Flat colour discs
// read as intentional illustration; broken <img> tags don't.
const FACES = [
  { initials: 'AR', color: 'coral' },
  { initials: 'MK', color: 'sky' },
  { initials: 'JD', color: 'lemon' },
  { initials: 'SP', color: 'grape' },
] as const;

export function AvatarStack({ className }: { className?: string }) {
  return (
    <div className={cn('flex -space-x-2.5', className)}>
      {FACES.map((f) => (
        <span
          key={f.initials}
          className="flex size-9 items-center justify-center rounded-full border-2 border-(--lp2-ink) text-[11px] font-extrabold text-(--lp2-ink)"
          style={{ backgroundColor: hue(f.color) }}
        >
          {f.initials}
        </span>
      ))}
    </div>
  );
}

/* ─── Wavy section edge ───────────────────────────────────────────── */

/**
 * Scalloped bottom edge for a section, so the hero doesn't end on a
 * ruler-straight line like every other SaaS page.
 *
 * `preserveAspectRatio="none"` lets the wave stretch to any viewport
 * width at a fixed height; `translateY(1px)` closes the hairline gap
 * browsers leave between an SVG's bottom edge and the next block at
 * fractional device-pixel ratios.
 */
export function WavyEdge({
  fill = 'var(--lp2-paper)',
  className,
}: {
  fill?: string;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 90"
      preserveAspectRatio="none"
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 h-12 w-full translate-y-px sm:h-16',
        className,
      )}
    >
      <path
        d="M0 46c120 34 240 44 360 30s240-52 360-52 240 38 360 52 240 4 360-30v54H0Z"
        fill={fill}
      />
    </svg>
  );
}
