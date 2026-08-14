import { Check, Info, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Highlight, Sparkle, Sticker } from './decor';
import { Btn } from './ui';

// ============================================================
// WhatsApp Business app vs the WhatsApp Business API.
//
// Objection handling, not a feature list: by this point in the page a
// reader who already has the free green app is asking "why would I pay
// for this?". The answer is a ceiling chart — every row is a limit the
// app imposes and the API doesn't.
//
// One deliberate exception: the "coding required" row is green on both
// sides. It's the app's genuine advantage, and a card where the right
// column is a wall of red crosses reads as marketing rather than fact.
//
// WHY TWO CARDS AND NOT A TABLE
//
// This section used to be a three-column grid with the recommended
// column washed green. It worked, but it read as a spec sheet — and a
// spec sheet invites the reader to audit rows rather than pick a side.
// It was also the one section on the page wearing none of the page's
// handwriting: no ink outline, no hard offset shadow, just gradients.
//
// Two cards fix both. The choice is staged as a choice — one card
// stuck down proud of the page (2px ink outline, 8px offset shadow,
// washed header, a tilted "Recommended" sticker overhanging the top
// edge), the other sketched in dashed rule on cream with no shadow and
// no button, so it reads as the option you are leaving behind. Same
// ten facts, same order, argued instead of tabulated.
//
// Both cards render from ROWS, so the two lists can never drift out of
// step — the whole comparison depends on row N meaning the same thing
// on both sides.
// ============================================================

type Tone = 'yes' | 'no';

type Cell = { text: string; tone: Tone };

const ROWS: { feature: string; hint: string; api: Cell; app: Cell }[] = [
  {
    feature: 'Broadcast limit',
    hint: 'How many people a single campaign can reach in one send.',
    api: { text: 'Unlimited contacts per campaign', tone: 'yes' },
    app: { text: 'Up to 256 contacts a day', tone: 'no' },
  },
  {
    feature: 'Broadcast reach',
    hint: 'Whether a broadcast reaches every opted-in contact, or only the people who saved your number in their phone first.',
    api: { text: 'Everyone who opted in', tone: 'yes' },
    app: { text: 'Only people who saved your number', tone: 'no' },
  },
  {
    feature: 'Multi-user access',
    hint: 'How many people can work the same WhatsApp number at the same time.',
    api: { text: 'Unlimited team members, one shared inbox', tone: 'yes' },
    app: { text: 'One phone plus four linked devices', tone: 'no' },
  },
  {
    feature: 'Automated messaging',
    hint: 'Replies, routing and follow-ups that fire on their own, without anyone typing.',
    api: { text: 'AI agents, flows and no-code automations', tone: 'yes' },
    app: { text: 'Greeting and away messages only', tone: 'no' },
  },
  {
    feature: 'Coding required',
    hint: 'Whether you need a developer before you can send your first message.',
    api: { text: 'None — Instant is the no-code layer', tone: 'yes' },
    app: { text: 'None — it is just an app', tone: 'yes' },
  },
  {
    feature: 'Verified green tick',
    hint: 'The green badge Meta puts next to a verified business name in chat.',
    api: { text: 'Eligible once your business is verified', tone: 'yes' },
    app: { text: 'Not available', tone: 'no' },
  },
  {
    feature: 'Clickable messages',
    hint: 'Buttons, quick replies and link CTAs inside the message, instead of asking people to type a reply.',
    api: { text: 'Buttons, quick replies and link CTAs', tone: 'yes' },
    app: { text: 'Plain text only', tone: 'no' },
  },
  {
    feature: 'Campaign analytics',
    hint: 'Reporting on what happened after you hit send — delivery and engagement, per campaign.',
    api: { text: 'Sent, delivered, read, replied and clicked', tone: 'yes' },
    app: { text: 'No campaign reporting', tone: 'no' },
  },
  {
    feature: 'CRM & software integrations',
    hint: 'Whether chats can flow into your CRM, store and other tools instead of staying trapped in the app.',
    api: { text: 'Built-in CRM, REST API and webhooks', tone: 'yes' },
    app: { text: 'Not possible', tone: 'no' },
  },
  {
    feature: 'Remarketing campaigns',
    hint: 'Bringing past customers back with sends targeted by tag, segment or past behaviour.',
    api: { text: 'Segments, tags and automatic follow-ups', tone: 'yes' },
    app: { text: 'Not possible', tone: 'no' },
  },
];

/**
 * Height floor for one feature row, so feature N sits at the same
 * y-position in both cards and the pair still scans across as a
 * comparison.
 *
 * The cards only sit side by side from `lg`, where each is about 570px
 * of content — every value string above is comfortably one line at that
 * width, and one line plus its caption and padding comes to ~54px. The
 * floor is set just above that. A value long enough to wrap would push
 * its own row past the floor and cost the rows below their alignment,
 * so keep new strings to roughly the length of the longest one here.
 */
const ROW_MIN_H = 'min-h-[3.5rem]';

/**
 * Inner corner radius. Cards are `rounded-3xl` (24px) with a 2px
 * border, so a fill sitting in a corner needs 22px to follow the curve.
 * The card can't use `overflow-hidden` to do this for it — the hint
 * tooltips and the sticker badge both have to escape.
 */
const INNER_CORNER = '22px';

/** Header wash on the recommended card. Strongest at the very top so
 *  the eye lands on the badge and the name, then falls into the list. */
const API_HEADER_WASH =
  'linear-gradient(to bottom, color-mix(in oklab, var(--lp2-grass) 22%, #fff), #fff)';

export function Lp2Compare() {
  return (
    <section id="compare" className="scroll-mt-28 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Heading is inlined rather than using <SectionHead> because
            this one title has to hold a single line: it needs viewport-
            relative sizing and `whitespace-nowrap`, neither of which the
            shared component offers. */}
        <div className="text-center">
          {/* Below `sm` the title wraps — one line on a phone would mean
              a 16px headline. From `sm` up the clamp keeps it on one
              line at every width, topping out at the page's usual
              section-title size. */}
          <h2 className="lp2-display text-3xl leading-[1.12] font-extrabold text-balance sm:text-[clamp(1.35rem,3.75vw,2.75rem)] sm:whitespace-nowrap">
            WhatsApp Business{' '}
            {/* The highlight block overshoots the word it frames, so it
                needs a little extra air or it collides with the words
                on either side. */}
            <Highlight color="tangerine" className="mx-[0.14em]">
              vs
            </Highlight>{' '}
            WhatsApp Business API
          </h2>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-lg">
            See how WhatsApp Business API compares to WhatsApp and the WhatsApp
            Business app.
          </p>
        </div>

        {/* `mt-16` rather than the usual 14 because the sticker badge
            overhangs the top of the first card by 16px. */}
        <div className="mt-16 grid gap-8 lg:grid-cols-2 lg:gap-7">
          <Card side="api" />
          <Card side="app" />
        </div>

        {/* The migration promise, under both cards rather than inside
            the winning one: it is the answer to "but I'm already on the
            app", which is a thought the reader has while looking at the
            card on the right. */}
        <p className="mx-auto mt-10 max-w-2xl text-center text-base leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-lg">
          Already on the app? Keep the same number — embedded signup migrates it
          to the API for you.
        </p>
      </div>
    </section>
  );
}

/* ─── One side of the face-off ────────────────────────────────────── */

const COPY = {
  api: {
    title: 'WhatsApp Business API',
    blurb: 'With Instant — growing businesses & enterprises',
  },
  app: {
    title: 'WhatsApp Business app',
    blurb: 'The free app — small businesses',
  },
} as const;

function Card({ side }: { side: 'api' | 'app' }) {
  const winner = side === 'api';
  const { title, blurb } = COPY[side];

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-3xl',
        winner
          ? // The page's handwriting, at the large shadow: this card is
            // a big object, and a 4px offset under a box this size
            // reads as a printing slip rather than as depth.
            'border-2 border-(--lp2-ink) bg-white shadow-(--lp2-shadow-lg)'
          : // Dashed, flat, no shadow, warm-grey ground. Nothing here is
            // broken — it is the same vocabulary with every emphatic
            // part removed, which is the argument the card is making.
            'border-2 border-dashed border-(--lp2-ink)/25 bg-(--lp2-cream)'
      )}
    >
      {winner && (
        // Overhangs the top-left corner so the card reads as something
        // stuck onto the page. Left rather than centred: centred puts it
        // directly above the card title and the two fight.
        <Sticker
          color="lemon"
          tilt={-3}
          className="absolute -top-4 left-6 z-20 gap-1.5 px-3 py-1.5 text-[11px] tracking-wide uppercase"
        >
          <Sparkle color="pop" className="size-3.5" />
          Recommended
        </Sticker>
      )}

      {/* ── Card head ──
          Identical padding on both cards, and no extra top padding for
          the badge: it overhangs *outside* the card, so it costs the
          header nothing. Any difference here would offset one card's
          whole list against the other's and cost every row below it its
          alignment — which is the one thing the pair has to get right. */}
      <div
        className="px-6 pt-7 pb-5"
        style={
          winner
            ? {
                backgroundImage: API_HEADER_WASH,
                borderTopLeftRadius: INNER_CORNER,
                borderTopRightRadius: INNER_CORNER,
              }
            : undefined
        }
      >
        <p
          className={cn(
            'lp2-display text-2xl font-extrabold sm:text-[1.75rem]',
            !winner && 'text-(--lp2-ink)/70'
          )}
        >
          {title}
        </p>
        <p className="mt-1.5 text-sm font-semibold text-(--lp2-ink-soft)">
          {blurb}
        </p>
      </div>

      {/* ── The ten facts ── */}
      <ul
        className={cn(
          'flex-1 border-t-2 border-dashed pt-1.5 pb-3',
          winner ? 'border-(--lp2-ink)/12' : 'border-(--lp2-ink)/15'
        )}
      >
        {ROWS.map((row) => (
          <Row
            key={row.feature}
            feature={row.feature}
            // The hint is defined once, on the recommended card only.
            // Both cards carry the same ten captions, so repeating the
            // tooltips would put twenty buttons in the tab order for ten
            // definitions. The API card is first in the DOM and first on
            // a stacked phone, so that is where the one copy lives.
            hint={winner ? row.hint : undefined}
            {...row[side]}
          />
        ))}
      </ul>

      {/* ── Card foot ── */}
      <div
        className={cn(
          'border-t-2 border-dashed px-6 py-5',
          winner ? 'border-(--lp2-ink)/12' : 'border-(--lp2-ink)/15'
        )}
      >
        {winner ? (
          <Btn href="/signup" className="h-12 w-full px-5 text-sm">
            Apply for the API — free
          </Btn>
        ) : (
          // No button on this card on purpose. It is the thing the
          // reader already has, so there is nothing to click — and a
          // second CTA here would split the one decision the section is
          // built to produce. The line is sized to the button opposite
          // so the two cards end level.
          <p className="flex h-12 items-center text-sm leading-snug font-semibold text-balance text-(--lp2-ink-soft)">
            Free, and stays free — but every limit above is Meta&rsquo;s, and no
            plan lifts them.
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── One feature, on one side ────────────────────────────────────── */

function Row({
  feature,
  hint,
  text,
  tone,
}: Cell & {
  feature: string;
  /** Omitted on the non-recommended card — see the call site. */
  hint?: string;
}) {
  const yes = tone === 'yes';

  // Ties the icon to its bubble for screen readers — the tooltip is only
  // visually hidden (opacity), so it stays in the accessibility tree.
  const hintId = `compare-hint-${feature.toLowerCase().replace(/[^a-z]+/g, '-')}`;

  return (
    <li className={cn('relative px-6 py-2', ROW_MIN_H)}>
      {/* Caption on its own line rather than beside the value, so the
          tick sits directly against the words it is vouching for. */}
      <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-(--lp2-ink-soft) uppercase">
        {feature}

        {hint && (
          // `peer` + a sibling tooltip rather than a group wrapper: the
          // tooltip is anchored to the *row*, not to the icon, so it can
          // never hang off the side of the card however long the caption
          // in front of it runs.
          <>
            <button
              type="button"
              aria-label={`What "${feature}" means`}
              aria-describedby={hintId}
              className="peer flex size-4 shrink-0 items-center justify-center rounded-full text-(--lp2-ink-soft) transition-colors hover:text-(--lp2-ink) focus-visible:text-(--lp2-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lp2-ink)"
            >
              <Info className="size-3.5" strokeWidth={2.75} />
            </button>

            <span
              id={hintId}
              role="tooltip"
              className="pointer-events-none absolute inset-x-4 bottom-full z-30 mb-1 rounded-xl border-2 border-(--lp2-ink) bg-(--lp2-ink) px-3 py-2 text-left text-xs leading-snug font-semibold text-white normal-case opacity-0 shadow-(--lp2-shadow-sm) transition-opacity duration-150 peer-hover:opacity-100 peer-focus-visible:opacity-100"
            >
              {hint}
            </span>
          </>
        )}
      </p>

      <p className="mt-1 flex items-start gap-2.5 text-sm leading-snug font-semibold">
        <span
          className={cn(
            'mt-px flex size-5 shrink-0 items-center justify-center rounded-full',
            // "Yes" keeps the full green — it is the answer the section
            // is arguing for. "No" is mixed toward white: ten saturated
            // coral discs down one card read as an error state rather
            // than a limitation.
            yes && 'bg-(--lp2-grass) text-white'
          )}
          style={
            yes
              ? undefined
              : {
                  backgroundColor:
                    'color-mix(in oklab, var(--lp2-coral) 30%, #fff)',
                }
          }
        >
          {yes ? (
            <Check className="size-3" strokeWidth={3.5} />
          ) : (
            <X className="size-3 text-(--lp2-ink)/60" strokeWidth={3.5} />
          )}
        </span>
        <span className={cn(!yes && 'text-(--lp2-ink)/75')}>{text}</span>
      </p>
    </li>
  );
}
