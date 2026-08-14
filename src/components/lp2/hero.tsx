import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, MessageCircle, Star } from 'lucide-react';

import { cn } from '@/lib/utils';
import { AvatarStack, DotField } from './decor';
import { RotatingHeadline } from './hero-headline';
import { press } from './ui';

// ============================================================
// /lp-2 hero.
//
// One centred column, type only: pitch, then proof. The chat-screen
// mockup that used to sit under the copy is gone — with nothing to
// compete against, the headline carries the fold on its own and is
// sized right up to the column to earn that.
//
// The headline is deliberately two lines with one highlighted phrase on
// each — the boxes land staggered (line one ends on its highlight, line
// two opens on one), which is what gives a centred block of type any
// shape at all. Those phrases rotate; see `hero-headline.tsx`.
//
// Server component apart from that headline: nothing else here is
// interactive beyond links.
// ============================================================

export function Lp2Hero() {
  return (
    // Two things going on with the spacing:
    //
    // `overflow-hidden` keeps the highlight boxes' offset shadows from
    // adding horizontal scroll at the narrowest widths, where the
    // headline runs nearly edge to edge.
    //
    // The negative top margin pulls the section up under the sticky
    // header (76px tall: pt-3 + h-16, 80px from `sm`) and the matching
    // padding puts the content back where it was. The nav floats, so
    // the soft-sky backdrop has to run behind it to the very top of the
    // screen — otherwise there's a flat band above the pill that gives
    // away where the hero really starts.
    //
    // Plain white, not a palette tint. The section below (`features`)
    // is also white, so the fold no longer ends on a colour change —
    // the dot grid is the only thing marking where the hero stops, and
    // it is deliberately the one texture this section has.
    <section className="relative -mt-19 overflow-hidden bg-white pt-19 sm:-mt-20 sm:pt-20">
      {/* Neutral grey rather than the default ink tint: at 13% ink the
          dots pick up the palette's blue lean, which is invisible on
          cream but reads as a faint blue cast on white. */}
      <DotField color="rgba(0,0,0,0.12)" />

      <FloatingLeads />

      {/* Single centred column. The padding is tighter top and bottom
          than it was with the mockup in place — a text-only fold with
          128px of empty cream under it reads as a page that failed to
          load something. */}
      <div className="relative mx-auto max-w-7xl px-4 pt-14 pb-20 sm:px-6 lg:pt-20 lg:pb-24">
        <Copy />
      </div>
    </section>
  );
}

/* ─── Floating leads ──────────────────────────────────────────────── */

// Faces drifting in the margins: the people whose messages the product
// answers, circling the pitch.
//
// Initials on a coloured disc rather than photographs. `public/
// hero-avatars/` is still a README and nothing else, and a stock face
// on a landing page is read as a stock face — a flat disc is at least
// honestly an illustration. If real customer photos ever land there,
// swap the span for an <Image> and keep everything else.
//
// They live strictly in the gutters. The hero's own note argues that
// confetti beside the first sentence someone reads is the most
// expensive decoration there is, and that still holds: the headline
// column is `max-w-4xl` inside a `max-w-7xl` section, so everything
// below is positioned out where the type never reaches.
const LEADS = [
  {
    initials: 'AR',
    hue: 'coral',
    side: 'left',
    top: '14%',
    inset: '3%',
    size: 'size-14',
    tilt: -8,
    delay: '0s',
    ping: true,
  },
  {
    initials: 'MK',
    hue: 'sky',
    side: 'left',
    top: '44%',
    inset: '9%',
    size: 'size-12',
    tilt: 6,
    delay: '1.6s',
  },
  {
    initials: 'SP',
    hue: 'grape',
    side: 'left',
    top: '72%',
    inset: '4%',
    size: 'size-16',
    tilt: -4,
    delay: '3.1s',
    ping: true,
  },
  {
    initials: 'JD',
    hue: 'lemon',
    side: 'right',
    top: '18%',
    inset: '5%',
    size: 'size-16',
    tilt: 7,
    delay: '0.8s',
  },
  {
    initials: 'RT',
    hue: 'tangerine',
    side: 'right',
    top: '48%',
    inset: '3%',
    size: 'size-12',
    tilt: -6,
    delay: '2.4s',
    ping: true,
  },
  {
    initials: 'NB',
    hue: 'mint',
    side: 'right',
    top: '76%',
    inset: '10%',
    size: 'size-14',
    tilt: 4,
    delay: '4s',
  },
] as const;

function FloatingLeads() {
  return (
    // Hidden below `lg`: the gutters that make this work only exist
    // once the viewport is wider than the content column. On a phone
    // these would sit on top of the headline.
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden lg:block"
    >
      {LEADS.map((lead) => (
        <span
          key={lead.initials}
          className={cn(
            'lp2-float absolute flex items-center justify-center rounded-full border-2 border-(--lp2-ink) text-sm font-extrabold shadow-(--lp2-shadow-sm)',
            lead.size
          )}
          style={
            {
              backgroundColor: `var(--lp2-${lead.hue})`,
              top: lead.top,
              [lead.side]: lead.inset,
              // Desynchronised: six discs bobbing in lockstep reads as one
              // object moving, not as a crowd.
              animationDelay: lead.delay,
              animationDuration: `${6 + (lead.tilt % 3)}s`,
              '--lp2-tilt': `${lead.tilt}deg`,
            } as CSSProperties
          }
        >
          {lead.initials}

          {/* An unread pip on some of them — the detail that makes a
              face read as an incoming conversation rather than a
              team-member avatar. */}
          {'ping' in lead && lead.ping && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-(--lp2-ink) bg-(--lp2-grass) text-[9px] text-white">
              <MessageCircle className="size-2.5" strokeWidth={3} />
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

/* ─── The pitch ───────────────────────────────────────────────────── */

function Copy() {
  return (
    <div className="relative text-center">
      {/* The Meta credential, moved up into what used to be the
          announcement slot.

          That slot was previously argued to be for news a reader acts
          on, which is why this sat down with the stars instead. With no
          announcement left to make, the argument inverts: this is the
          strongest thing the page can say before the pitch, and the
          reader meets it on the way into the headline rather than after
          it. The pill keeps the same quiet treatment — soft fill,
          hairline border, no tilt.

          A `span`, not a `Link`: it is a credential, not a CTA, and
          nothing useful sits behind a click. */}
      <span className="inline-flex items-center gap-2 rounded-full border border-(--lp2-ink)/12 bg-white/70 py-1.5 pr-3.5 pl-3 text-xs font-semibold">
        {/* `alt=""` on purpose — the words next to it already say
            "Meta", so naming the logo makes a screen reader read the
            brand twice. Intrinsic size is 4096×825; the props below are
            the display size so the optimiser serves ~80px rather than
            resizing a 150KB PNG in the browser, and `w-auto` keeps the
            true aspect ratio regardless. */}
        <Image
          src="https://media.instant.nebkern.com/assets/meta-logo.png"
          alt=""
          width={79}
          height={16}
          priority
          className="h-4 w-auto"
        />
        Official Meta Tech Provider
      </span>

      {/* Two hard-broken lines rather than a `text-balance` blob: the
          whole point of the shape is one highlight per line, and letting
          the browser rewrap would put both boxes on one row at some
          widths and none on another. The lines themselves live in
          `hero-headline.tsx`, which rotates the highlighted phrases.

          The ceiling on every size is the longest line any phrase can
          produce: `Highlight` is `whitespace-nowrap`, so "Turn WhatsApp
          chats" has to fit the column unbroken at every width. Measured
          in DM Sans at weight 800 with this tracking, that run is
          10.37em — which is what every number below is derived from,
          each left ~8% under the width where it would wrap. It is also
          the budget every rotating phrase is checked against.

          Below `sm` the size is fluid rather than fixed, because that
          constraint is proportional: the column is `100vw - 32px`, so a
          `vw` size holds the same margin at every phone width instead
          of being tuned for one. 8.4vw fills 360px comfortably and
          still fits a 320px screen, which the old fixed 1.8rem did not.
          The 2.25rem cap stops it running away on tablets before `sm`
          takes over.

          Leading stays looser than a normal display headline (1.2–1.3
          vs the usual ~1.15) to make room for the highlight boxes —
          they overshoot the text by 0.04em top and bottom plus a 4px
          offset shadow, and at tight leading the shadow of line one
          lands on the box of line two. It tightens as the size grows
          because the ratio that reads as air at 30px reads as a gap at
          80px. */}
      <h1 className="lp2-display mx-auto mt-6 max-w-4xl text-[min(2.25rem,8.4vw)] leading-[1.3] font-extrabold tracking-tight sm:mt-7 sm:text-[3.25rem] sm:leading-[1.24] md:text-[4rem] lg:text-[5rem] lg:leading-[1.2]">
        <RotatingHeadline />
      </h1>

      <p className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-pretty text-(--lp2-ink-soft) sm:mt-8 sm:text-lg">
        One shared inbox for the whole team. AI agents that answer in seconds.
        Campaigns, pipelines and automations that keep every conversation moving
        towards a sale.
      </p>

      {/* One button, so there is nothing to choose between — the fold
          asks for exactly one thing. It still stretches full width on a
          phone (thumb target) and sits at its own width, centred, from
          `sm` up. */}
      <div className="mt-8 flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-center">
        <Link
          href="/signup"
          className={cn(
            'inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-(--lp2-grass) px-7 text-base font-bold text-white transition-colors hover:bg-(--lp2-ink)',
            press
          )}
        >
          Start free — 14 days
          <ArrowRight className="size-4" strokeWidth={2.5} />
        </Link>
      </div>

      {/* Social proof. Small, grounded, and deliberately not another
          outlined card — the eye needs somewhere to rest after four
          consecutive bordered blocks. */}
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <AvatarStack className="scale-90" />
        <div className="text-center sm:text-left">
          <div className="flex justify-center gap-0.5 sm:justify-start">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className="size-3.5 fill-(--lp2-lemon) text-(--lp2-ink)"
                strokeWidth={1.5}
              />
            ))}
          </div>
          <p className="mt-1 text-[13px] font-semibold text-(--lp2-ink-soft)">
            Loved by <span className="text-(--lp2-ink)">2,000+</span> teams
            selling on WhatsApp
          </p>
        </div>
      </div>

      {/* No decoration in here at all — no squiggle, no sparkle, and
          since the mockup came out, no stickers either. Confetti next
          to the first sentence someone reads is the most expensive kind
          of decoration: it competes with the one thing on the page that
          has to land. The dot field and the highlight boxes carry what
          personality this fold needs. */}
    </div>
  );
}
