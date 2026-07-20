'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Play, ShoppingBag } from 'lucide-react';

import { avatarColor } from '@/lib/avatar-color';
import { softBadge } from '@/lib/badge-colors';
import { cn } from '@/lib/utils';

/* ─── Hero orbit ──────────────────────────────────────────────────────
   Customers circling the product: two dashed concentric rings carrying
   avatar chips. The hero copy's claim is "these questions are in the
   air, out of arm's reach", so the chips never settle — until you
   reach for one, at which point the whole system eases to a stop and
   the loose question resolves into a tracked deal.

   Why this is a client component: hovering has to DECELERATE the
   rotation, and CSS can't ease `animation-play-state` — it's a binary
   flip that reads as a glitch. Ramping `playbackRate` through the Web
   Animations API is the only way to get a real ease-out, and that
   needs a browser. The rest of landing-visuals stays on the server. */

/** What the customer sent — most are text, a couple are richer. */
type OrbitPayload =
  | { kind: 'text'; message: string }
  | { kind: 'voice'; duration: string }
  | { kind: 'catalogue'; item: string; price: string };

interface OrbitChip {
  /** Also the avatar-colour seed and the initials fallback. */
  name: string;
  /** Full name, shown on the hover card. */
  fullName: string;
  /**
   * Photo under /public. Optional on purpose: when the file is absent
   * the chip falls back to a coloured initial, so a missing asset
   * degrades instead of showing a broken-image icon on the front page.
   */
  photo?: string;
  payload: OrbitPayload;
  /** Pipeline detail revealed on hover — the payoff of the metaphor:
   *  the loose question is already a tracked deal. */
  deal: string;
  stage: string;
  note: string;
  /** Degrees clockwise from 3 o'clock. */
  angle: number;
  /** Open the bubble to the LEFT of the avatar. Set on right-hand
   *  chips so every bubble points back toward the copy. */
  flip?: boolean;
}

const OUTER_CHIPS: OrbitChip[] = [
  {
    name: 'Priya',
    fullName: 'Priya Sharma',
    photo: '/hero-avatars/priya.jpg',
    payload: { kind: 'text', message: 'What is the price?' },
    deal: '₹48,000',
    stage: 'Negotiation',
    note: 'Asked for bulk pricing on 40 units.',
    angle: 188,
  },
  {
    name: 'Rahul',
    fullName: 'Rahul Mehta',
    photo: '/hero-avatars/rahul.jpg',
    payload: { kind: 'voice', duration: '0:14' },
    deal: '₹1,20,000',
    stage: 'Proposal sent',
    note: 'Voice note transcribed by AI — wants a callback at 4pm.',
    angle: 340,
    flip: true,
  },
  {
    name: 'Aisha',
    fullName: 'Aisha Khan',
    photo: '/hero-avatars/aisha.jpg',
    payload: { kind: 'text', message: 'Do you deliver to Pune?' },
    deal: '₹22,500',
    stage: 'Qualified',
    note: 'Serviceable pincode — auto-replied with delivery window.',
    angle: 92,
  },
];

const INNER_CHIPS: OrbitChip[] = [
  {
    name: 'Vikram',
    fullName: 'Vikram Rao',
    photo: '/hero-avatars/vikram.jpg',
    payload: { kind: 'text', message: 'Is this in stock?' },
    deal: '₹9,800',
    stage: 'New lead',
    note: 'Stock check answered from the catalogue in 3 seconds.',
    angle: 244,
  },
  {
    name: 'Neha',
    fullName: 'Neha Iyer',
    photo: '/hero-avatars/neha.jpg',
    payload: { kind: 'catalogue', item: 'Silk Kurta Set', price: '₹2,499' },
    deal: '₹34,000',
    stage: 'Won',
    note: 'Ordered 12 sets straight from the shared catalogue.',
    angle: 32,
    flip: true,
  },
  {
    name: 'Arjun',
    fullName: 'Arjun Nair',
    photo: '/hero-avatars/arjun.jpg',
    payload: { kind: 'text', message: 'Any discount on bulk?' },
    deal: '₹76,200',
    stage: 'Follow-up',
    note: 'Automation nudged him after 48h of silence.',
    angle: 140,
  },
];

/** Percent offsets for a point at `angle` on a ring of `radiusPct`. */
function chipPosition(angle: number, radiusPct: number) {
  const rad = (angle * Math.PI) / 180;
  return {
    left: `${50 + radiusPct * Math.cos(rad)}%`,
    top: `${50 + radiusPct * Math.sin(rad)}%`,
  };
}

/** Fake waveform for the voice note — a fixed array so server and
 *  client render identically. */
const VOICE_BARS = [5, 9, 14, 8, 12, 16, 7, 11, 6, 13, 9, 5];

function OrbitBubbleBody({ payload }: { payload: OrbitPayload }) {
  if (payload.kind === 'voice') {
    return (
      <span className="flex items-center gap-2">
        <span className="bg-primary-soft text-primary flex size-6 shrink-0 items-center justify-center rounded-full">
          <Play className="size-2.5 fill-current" />
        </span>
        <span className="flex items-end gap-0.5">
          {VOICE_BARS.map((h, i) => (
            <span
              key={i}
              className="bg-muted-foreground/45 w-0.5 rounded-full"
              style={{ height: `${h}px` }}
            />
          ))}
        </span>
        <span className="text-muted-foreground text-[10px] tabular-nums">
          {payload.duration}
        </span>
      </span>
    );
  }

  if (payload.kind === 'catalogue') {
    return (
      <span className="flex items-center gap-2">
        <span className="bg-primary-soft text-primary flex size-8 shrink-0 items-center justify-center rounded-md">
          <ShoppingBag className="size-4" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[11px] font-medium">{payload.item}</span>
          <span className="text-muted-foreground text-[10px]">
            {payload.price}
          </span>
        </span>
      </span>
    );
  }

  return <>{payload.message}</>;
}

function OrbitChipNode({
  chip,
  radiusPct,
  counterClass,
  onEnter,
  onLeave,
}: {
  chip: OrbitChip;
  radiusPct: number;
  counterClass: string;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const avatar = avatarColor(chip.name);

  // Grow the card out of the avatar rather than from its own middle —
  // an expansion that starts where the cursor already is reads as one
  // object opening, not a second object appearing.
  const origin = chip.flip ? 'origin-right' : 'origin-left';

  return (
    // Lift the hovered chip above its neighbours so an expanding card
    // is never underlapped by the avatar next to it.
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 hover:z-10"
      style={chipPosition(chip.angle, radiusPct)}
    >
      <div className={counterClass}>
        {/*
          The AVATAR is what sits on the stroke — everything else is
          absolute against it and hangs inward. Centring the whole chip
          instead would push half its width past the ring, which at 3
          and 9 o'clock runs straight off the viewport.

          `pointer-events-auto` re-enables hits that the orbit root
          switches off, so the empty middle of the rings never steals
          clicks from the headline and CTA behind it.
        */}
        <div
          className="group/chip pointer-events-auto relative"
          onPointerEnter={onEnter}
          onPointerLeave={onLeave}
        >
          <span
            className="ring-background block size-11 overflow-hidden rounded-full shadow-sm ring-4 transition-transform duration-300 ease-out group-hover/chip:scale-110"
            style={{ backgroundColor: avatar.bg }}
          >
            {chip.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={chip.photo}
                alt=""
                loading="lazy"
                className="size-full object-cover"
              />
            ) : (
              <span
                className="flex size-full items-center justify-center text-sm font-semibold"
                style={{ color: avatar.fg }}
              >
                {chip.name.charAt(0)}
              </span>
            )}
          </span>

          {/* Resting state: the message as it arrived. Fades out a touch
              faster than the card fades in, so they cross rather than
              stack. */}
          <span
            className={cn(
              'border-border/60 bg-card text-foreground pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-xl border px-3 py-1.5 text-xs whitespace-nowrap shadow-sm',
              'transition-[opacity,transform] duration-200 ease-out',
              'group-hover/chip:scale-95 group-hover/chip:opacity-0',
              origin,
              chip.flip
                ? 'right-full mr-2 rounded-br-sm'
                : 'left-full ml-2 rounded-bl-sm',
            )}
          >
            <OrbitBubbleBody payload={chip.payload} />
          </span>

          {/* Hover state: the same person as a tracked deal.
              cubic-bezier(0.32, 0.72, 0, 1) is a slow-out/fast-settle
              curve — it decelerates hard at the end, which is what
              gives the pop its "placed" feel instead of a linear fade. */}
          <div
            className={cn(
              'border-border bg-card pointer-events-none absolute top-1/2 w-64 -translate-y-1/2 rounded-xl border p-3 text-left shadow-xl',
              'scale-90 opacity-0 blur-[2px]',
              'transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
              'group-hover/chip:scale-100 group-hover/chip:opacity-100 group-hover/chip:blur-none',
              origin,
              chip.flip ? 'right-full mr-2' : 'left-full ml-2',
            )}
          >
            <p className="text-foreground text-sm font-semibold">
              {chip.fullName}
            </p>

            <div className="mt-2.5 flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-[11px]">
                Deal value
              </span>
              <span className="text-foreground text-sm font-semibold tabular-nums">
                {chip.deal}
              </span>
            </div>

            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-[11px]">Stage</span>
              <span
                className={cn(
                  'rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                  softBadge.primary,
                )}
              >
                {chip.stage}
              </span>
            </div>

            <p className="border-border/60 text-muted-foreground mt-2.5 border-t pt-2.5 text-[11px] leading-relaxed">
              {chip.note}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One dashed, travelling ring. `r` is in the 0–100 viewBox space. */
function OrbitRing({
  r,
  dash,
  className,
}: {
  r: number;
  dash: string;
  className: string;
}) {
  return (
    <circle
      cx="50"
      cy="50"
      r={r}
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeDasharray={dash}
      strokeLinecap="round"
      // Without this the 100-unit viewBox scales the stroke up with the
      // container and the "thin" ring renders as a heavy band.
      vectorEffect="non-scaling-stroke"
      className={className}
    />
  );
}

// Every element driven by a CSS animation in this subtree. Collected by
// class because the ramp has to reach the ring carriers, the per-chip
// counter-rotations, AND the two dashed strokes — miss one and it keeps
// sliding while the rest stops.
const ANIMATED = [
  '.animate-orbit',
  '.animate-orbit-slow',
  '.animate-orbit-item',
  '.animate-orbit-item-slow',
  '.animate-dash-trail',
  '.animate-dash-trail-reverse',
].join(',');

/** Long enough to feel like momentum, short enough that the card has
 *  settled by the time you finish reading the name. */
const RAMP_MS = 620;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function HeroOrbit() {
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);

  /**
   * Ease every animation's playbackRate toward `target` (0 = stopped,
   * 1 = full speed).
   *
   * Rate is the right knob rather than play/pause: it never touches
   * `currentTime`, so the rings coast to a halt from wherever they
   * happen to be and resume from that exact point — no snapping back
   * to a keyframe boundary.
   */
  const rampTo = useCallback((target: number) => {
    const root = rootRef.current;
    if (!root) return;

    const animations = Array.from(
      root.querySelectorAll<HTMLElement | SVGElement>(ANIMATED),
    ).flatMap((el) => el.getAnimations());

    // Empty under prefers-reduced-motion (the animations are `none`),
    // which is exactly right — nothing to decelerate.
    if (animations.length === 0) return;

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

    const from = animations[0].playbackRate;
    const start = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / RAMP_MS);
      const rate = from + (target - from) * easeOutCubic(t);
      for (const a of animations) a.playbackRate = rate;
      frameRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };

    frameRef.current = requestAnimationFrame(step);
  }, []);

  const stop = useCallback(() => rampTo(0), [rampTo]);
  const resume = useCallback(() => rampTo(1), [rampTo]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return (
    // 1240px wide, xl-only — wider than the section, so the rings clip
    // against its edges by design.
    //
    // z-99 sits on the ROOT, not the chips: the root's -translate
    // creates a stacking context, so a z-index on a chip can only
    // compete with its siblings inside this subtree, never with the
    // headline. The rings clear the copy by ~190px, so nothing crosses
    // the text except a hover card — which is exactly what we want on
    // top. Still pointer-events-none, so it can't swallow CTA clicks.
    <div
      ref={rootRef}
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-1/2 z-99 hidden aspect-square w-310 -translate-x-1/2 -translate-y-1/2 xl:block"
    >
      {/* Dashed strokes that march in opposite directions, so the two
          rings read as separate currents rather than one turning disc.
          Inner radius clears a max-w-lg column with ~100px to spare. */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 size-full overflow-visible"
      >
        <OrbitRing
          r={49.5}
          dash="1.1 1.5"
          className="text-border animate-dash-trail"
        />
        <OrbitRing
          r={36}
          dash="0.8 1.6"
          className="text-border/70 animate-dash-trail-reverse"
        />
      </svg>

      {/* Outer carrier. */}
      <div className="animate-orbit absolute inset-0">
        {OUTER_CHIPS.map((chip) => (
          <OrbitChipNode
            key={chip.name}
            chip={chip}
            radiusPct={49.5}
            counterClass="animate-orbit-item"
            onEnter={stop}
            onLeave={resume}
          />
        ))}
      </div>

      {/* Inner carrier — slower, so the rings never lock into a single
          rotating mass. */}
      <div className="animate-orbit-slow absolute inset-0">
        {INNER_CHIPS.map((chip) => (
          <OrbitChipNode
            key={chip.name}
            chip={chip}
            radiusPct={36}
            counterClass="animate-orbit-item-slow"
            onEnter={stop}
            onLeave={resume}
          />
        ))}
      </div>
    </div>
  );
}
