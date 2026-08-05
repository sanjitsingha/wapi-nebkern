import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  CheckCheck,
  Play,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { AvatarStack, DotField, Sparkle, Sticker } from './decor';
import { press } from './ui';

// ============================================================
// /lp-2 hero.
//
// Two columns: the pitch on the left, a chat card cluster on the right.
// The cluster is the whole argument in one glance — a real conversation
// being answered instantly — so it gets the stickers, the tilt and the
// motion, while the copy column stays calm enough to actually read.
//
// Server component: nothing here is interactive beyond links and CSS
// animation.
// ============================================================

export function Lp2Hero() {
  return (
    // Two things going on with the spacing:
    //
    // `overflow-hidden` is load-bearing — the blobs and the outermost
    // stickers deliberately hang past the content column, and without
    // the clip they'd add horizontal scroll on small screens.
    //
    // The negative top margin pulls the section up under the sticky
    // header (76px tall: pt-3 + h-16, 80px from `sm`) and the matching
    // padding puts the content back where it was. The nav floats, so
    // the soft-sky backdrop has to run behind it to the very top of the
    // screen — otherwise there's a flat band above the pill that gives
    // away where the hero really starts.
    //
    // Single flat colour rather than the earlier stack of blurred
    // colour blobs: the wash read as a gradient, and the ask was for
    // one colour. Swap `--lp2-sky-soft` here for any other palette
    // token to recolour the whole hero.
    <section className="relative -mt-19 overflow-hidden bg-(--lp2-sky-soft) pt-19 sm:-mt-20 sm:pt-20">
      {/* Dots only — the single subtle texture that grounds the
          floating stickers. No colour blobs; the flat fill above is the
          background now. */}
      <DotField />

      {/* `lg:min-h-208` (52rem) gives the hero real vertical presence —
          the copy centres in the taller space while the chat stack
          (self-end) drops to the bottom and bleeds off the fold. */}
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-24 sm:px-6 lg:min-h-208 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:pt-14 lg:pb-32">
        <Copy />
        <ChatCluster />
      </div>
    </section>
  );
}

/* ─── Left column: the pitch ──────────────────────────────────────── */

function Copy() {
  return (
    <div className="relative text-center lg:text-left">
      {/* Announcement pill — straightened. It used to sit at -1.5° with
          a 2px ink outline and an offset shadow, which is a lot of
          personality before the reader has met a single word. A soft
          fill and a hairline border say the same thing quietly. */}
      <Link
        href="#ai-agents"
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-(--lp2-ink)/12 bg-white/70 py-1.5 pr-3.5 pl-3 text-xs font-semibold transition-colors hover:bg-white',
          press,
        )}
      >
        <Sparkles className="size-3.5 text-(--lp2-grass)" strokeWidth={2.5} />
        AI agents that reply while you sleep
      </Link>

      <h1 className="lp2-display mt-5 text-[2.15rem] leading-[1.2] font-extrabold tracking-tight text-balance sm:text-5xl sm:leading-[1.15] lg:text-[3.4rem]">
        WhatsApp marketing,{' '}
        <span className="text-(--lp2-grass)">automated</span>.
      </h1>

      <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-pretty text-(--lp2-ink-soft) lg:mx-0">
        One shared inbox for the whole team. AI agents that answer in
        seconds. Campaigns, pipelines and automations that turn every
        &ldquo;is this available?&rdquo; into a paid order.
      </p>

      <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
        {/* One emphatic button, one quiet one. Both previously carried
            the ink outline plus a hard offset shadow, so neither led —
            two stickers competing. */}
        <Link
          href="/signup"
          className={cn(
            'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-(--lp2-grass) px-6 text-[15px] font-bold text-white transition-colors hover:bg-(--lp2-ink)',
            press,
          )}
        >
          Start free — 14 days
          <ArrowRight className="size-4" strokeWidth={2.5} />
        </Link>

        <Link
          href="#features"
          className={cn(
            'inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-(--lp2-ink)/15 bg-white px-5 text-[15px] font-semibold transition-colors hover:bg-(--lp2-cream)',
            press,
          )}
        >
          <Play className="size-3.5 fill-current" />
          See it in action
        </Link>
      </div>

      {/* Social proof. Small, grounded, and deliberately not another
          outlined card — the eye needs somewhere to rest after four
          consecutive bordered blocks. */}
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
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

      {/* Meta Tech Provider credential. Deliberately down here with the
          stars rather than up in the announcement pill: that slot is for
          news a reader acts on, and this is the thing they look for at
          the moment they start believing the pitch. Outlined white so it
          reads as a stamp, not another CTA. */}
      <div className="mt-5 flex justify-center lg:justify-start">
        <span className="inline-flex items-center gap-2 rounded-full border border-(--lp2-ink)/12 bg-white/70 px-3.5 py-1.5 text-xs font-semibold">
          <BadgeCheck
            className="size-4 shrink-0 text-(--lp2-grass)"
            strokeWidth={2.5}
          />
          Official Meta Tech Provider
        </span>
      </div>

      {/* The squiggle and sparkle that floated beside the headline are
          gone. Confetti next to the first sentence someone reads is the
          most expensive kind of decoration — it competes with the one
          thing on the page that has to land. The chat cluster on the
          right still carries the personality. */}
    </div>
  );
}

/* ─── Right column: the conversation ──────────────────────────────── */

// One incoming question, two instant answers, and a reply still being
// typed — the shortest possible story of "nobody is waiting".
const THREAD = [
  {
    side: 'in',
    text: 'Do you deliver to Pune? 🛵',
    time: '22:47',
  },
  {
    side: 'out',
    text: 'Yes! Same-day delivery in Pune on orders before 6pm.',
    time: '22:47',
    ai: true,
  },
  {
    side: 'in',
    text: 'Can I pay on delivery?',
    time: '22:48',
  },
  {
    side: 'out',
    text: 'Absolutely — cash or UPI at your door. Want me to place it now?',
    time: '22:48',
    ai: true,
  },
] as const;

function ChatCluster() {
  return (
    // Capped at 26rem even on wide screens (and pushed to the right
    // rail with `lg:mr-0`) rather than filling its grid column: at full
    // column width the bubbles stretch to ~50 characters and stop
    // looking like phone messages, which is the entire illusion.
    //
    // `self-end` + `lg:-mb-24` drop the stack to the bottom of the hero
    // and let it bleed off the section's bottom edge (the hero clips
    // with overflow-hidden), so the screens read as rising up from the
    // fold rather than floating in the middle of it.
    <div className="relative mx-auto w-full max-w-md self-end lg:mr-0 lg:-mb-24 lg:max-w-104">
      {/* Back screen — a second chat window offset down-right so a clear
          band of it shows behind the front one: two screens, not one.
          Static, straight (no tilt), sharp corners, filled with
          placeholder chrome so the visible strip still reads as a
          screen. */}
      <div
        aria-hidden
        className="absolute inset-0 overflow-hidden border-2 border-(--lp2-ink) bg-white shadow-(--lp2-shadow-lg)"
        style={{ transform: 'translate(2.75rem, 2.25rem)' }}
      >
        <div className="border-b-2 border-(--lp2-ink) bg-(--lp2-lemon) px-4 py-3.5">
          <span className="block h-3 w-24 rounded-full bg-(--lp2-ink)/25" />
        </div>
        <div className="space-y-3 bg-(--lp2-cream) p-4">
          <span className="block h-9 w-2/3 rounded-2xl border-2 border-(--lp2-ink) bg-white" />
          <span className="ml-auto block h-11 w-3/4 rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-mint)" />
          <span className="block h-9 w-1/2 rounded-2xl border-2 border-(--lp2-ink) bg-white" />
        </div>
      </div>

      {/* Front screen — the full conversation. Static, straight and
          sharp-cornered to match the back. */}
      <div className="relative overflow-hidden border-2 border-(--lp2-ink) bg-white shadow-(--lp2-shadow-lg)">
        {/* Header */}
        <div className="flex items-center gap-3 border-b-2 border-(--lp2-ink) bg-(--lp2-mint) px-4 py-3">
          <span className="flex size-10 items-center justify-center rounded-full border-2 border-(--lp2-ink) bg-(--lp2-tangerine) text-xs font-extrabold">
            NS
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold">Nova Store</p>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-(--lp2-ink-soft)">
              <span className="size-2 rounded-full bg-(--lp2-grass)" />
              AI agent · online
            </p>
          </div>
          <span className="rounded-full border-2 border-(--lp2-ink) bg-white px-2.5 py-1 text-[10px] font-extrabold tracking-wide uppercase">
            WhatsApp
          </span>
        </div>

        {/* Thread */}
        <div className="space-y-2.5 bg-(--lp2-cream) px-4 py-4">
          {THREAD.map((m) => (
            <Bubble key={m.text} {...m} />
          ))}

          {/* Typing indicator — the beat that makes the thread feel
              live rather than screenshotted. */}
          <div className="flex justify-end">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-br-md border-2 border-(--lp2-ink) bg-(--lp2-mint) px-3.5 py-2.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="lp2-typing-dot size-2 rounded-full bg-(--lp2-ink)"
                  style={{ animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Composer — non-interactive set dressing, so it's a div, not
            a real input someone can click into and find dead. */}
        <div className="flex items-center gap-2 border-t-2 border-(--lp2-ink) bg-white px-3.5 py-2.5">
          <div className="flex-1 rounded-full border-2 border-(--lp2-ink)/15 bg-(--lp2-cream) px-3.5 py-2 text-[13px] font-medium text-(--lp2-ink-soft)">
            Type a message…
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-(--lp2-ink) bg-(--lp2-grass)">
            <ArrowRight className="size-4 text-white" strokeWidth={3} />
          </span>
        </div>
      </div>

      {/* ── Stickers pinned to the card ──
          Static now, to match the screens — nothing floats. Hidden
          below `sm`: at phone widths they'd land on top of the
          conversation, which is the one thing that must stay readable. */}
      <Sticker
        color="lemon"
        tilt={-8}
        className="absolute -top-5 -left-4 hidden text-xs sm:flex lg:-left-12"
      >
        <Zap className="size-4" strokeWidth={3} />
        6s average reply
      </Sticker>

      {/* Parked at 42% rather than lower down: the typing indicator
          lives near the card's bottom edge and it's the one detail
          that sells "answering right now" — a sticker on top of it
          costs more than it adds. */}
      <Sticker
        color="sky"
        tilt={7}
        className="absolute -right-4 bottom-[42%] hidden text-xs text-white sm:flex lg:-right-10"
      >
        <CheckCheck className="size-4" strokeWidth={3} />
        +38% more replies
      </Sticker>

      {/* Left edge, at the height of an AI reply: those bubbles are
          right-aligned, so the card's left side there is empty cream —
          the one spot a sticker can straddle without covering text. */}
      <Sticker
        color="coral"
        tilt={-5}
        className="absolute bottom-32 -left-6 hidden text-xs text-white sm:flex lg:-left-20"
      >
        1,240 chats handled today
      </Sticker>

      <Sparkle color="lemon" className="absolute -top-8 right-10 size-7" />
    </div>
  );
}

function Bubble({
  side,
  text,
  time,
  ai,
}: {
  side: 'in' | 'out';
  text: string;
  time: string;
  ai?: boolean;
}) {
  const out = side === 'out';
  return (
    <div className={cn('flex', out ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          // The squared-off corner on the speaker's side is what makes
          // a rounded rectangle read as a speech bubble.
          'max-w-[85%] rounded-2xl border-2 border-(--lp2-ink) px-3 py-2 text-[13px] font-medium shadow-[2px_2px_0_var(--lp2-ink)]',
          out ? 'rounded-br-md bg-(--lp2-mint)' : 'rounded-bl-md bg-white',
        )}
      >
        {ai && (
          <span className="mb-1.5 inline-flex items-center gap-1 rounded-full border-2 border-(--lp2-ink) bg-(--lp2-lemon) px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase">
            <Sparkles className="size-2.5" strokeWidth={3} />
            AI
          </span>
        )}
        <p className="leading-snug">{text}</p>
        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] font-bold text-(--lp2-ink-soft)">
          {time}
          {out && <CheckCheck className="size-3 text-(--lp2-sky)" strokeWidth={3} />}
        </p>
      </div>
    </div>
  );
}
