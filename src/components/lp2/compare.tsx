import { Check, Info, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Highlight, Sparkle } from './decor';
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
// sides. It's the app's genuine advantage, and a table where the right
// column is a wall of red crosses reads as marketing rather than fact.
//
// Layout is a grid, not a <table>, so it can restack: three columns on
// desktop, and on mobile each feature becomes a small card whose two
// halves carry their own inline labels (`sm:sr-only` — visible on
// mobile, still announced on desktop, where the grid gives screen
// readers no header association of its own).
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

// Shared column template. Declared once because the header row and every
// body row have to agree on it — the moment they drift, the ticks stop
// lining up under their heading.
const COLS = 'sm:grid-cols-[1.15fr_1fr_1fr]';

// Inner corner radius: the card is rounded-2xl (16px) with a 1px border,
// so cells that sit in a corner need 15px to follow the curve. The card
// itself can't use `overflow-hidden` to do this for them — the hint
// tooltips have to escape it.
const CORNER = '15px';

/**
 * The recommended column's wash, drawn as one continuous gradient
 * behind the grid rather than tinting each cell.
 *
 * Tinting cells individually restarts the gradient in every row, which
 * reads as ten stripes instead of one column. So a single absolutely
 * positioned panel sits behind them, and these numbers are derived
 * from COLS above: the track is 1.15 + 1 + 1 = 3.15fr, so the API
 * column starts at 1.15/3.15 and is 1/3.15 wide. Change COLS and these
 * two have to change with it.
 */
const API_COL_LEFT = `${(1.15 / 3.15) * 100}%`;
const API_COL_WIDTH = `${(1 / 3.15) * 100}%`;

export function Lp2Compare() {
  return (
    // White section with the colour carried by the card, the same way
    // `features` works — the table *is* the panel here, so a second
    // washed band behind it would be two panels deep.
    <section id="compare" className="scroll-mt-28 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
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

        {/* Hairline border in a softened tangerine instead of the 2px
            ink outline and hard offset shadow: the washes define this
            now, and a heavy frame around a gradient fights it. */}
        <div
          className="relative mt-14 rounded-2xl border bg-white"
          style={{
            borderColor: 'color-mix(in oklab, var(--lp2-tangerine) 45%, #fff)',
          }}
        >
          {/* The recommended column's wash — one panel behind the whole
              grid, strongest at the top so the eye starts at the header
              and follows the column down. Hidden below `sm`, where the
              cells stack and there is no column to wash. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 hidden sm:block"
            style={{
              left: API_COL_LEFT,
              width: API_COL_WIDTH,
              backgroundImage:
                'linear-gradient(to bottom, color-mix(in oklab, var(--lp2-grass) 24%, #fff), color-mix(in oklab, var(--lp2-grass) 5%, #fff))',
              borderTopRightRadius: 0,
            }}
          />

          {/* Column headings. Hidden on mobile, where the stacked cells
              label themselves instead. */}
          <div className={cn('relative hidden sm:grid', COLS)}>
            <div style={{ borderTopLeftRadius: CORNER }} />
            <div className="relative px-5 py-6 text-center">
              <span className="absolute top-0 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-b-lg bg-(--lp2-grass) px-2.5 py-1 text-[10px] font-bold tracking-wide text-white uppercase">
                <Sparkle color="lemon" className="size-2.5" />
                Recommended
              </span>
              <p className="lp2-display mt-3 text-lg font-extrabold">
                WhatsApp Business API
              </p>
              <p className="mt-1 text-xs font-semibold text-(--lp2-ink-soft)">
                With Instant — growing businesses &amp; enterprises
              </p>
            </div>
            <div
              className="border-l border-(--lp2-ink)/8 px-5 py-6 text-center"
              style={{ borderTopRightRadius: CORNER }}
            >
              <p className="lp2-display mt-3 text-lg font-extrabold">
                WhatsApp Business app
              </p>
              <p className="mt-1 text-xs font-semibold text-(--lp2-ink-soft)">
                The free app — small businesses
              </p>
            </div>
          </div>

          {ROWS.map((row, i) => (
            <div
              key={row.feature}
              className={cn(
                'relative grid border-t border-(--lp2-ink)/8',
                COLS,
                // On mobile the headings are gone, so the first row sits
                // directly against the card's top edge — its own top
                // border would double up with the card outline.
                i === 0 && 'max-sm:border-t-0'
              )}
            >
              <Feature
                name={row.feature}
                hint={row.hint}
                roundTopOnMobile={i === 0}
              />
              <Value {...row.api} label="With the API" />
              <Value {...row.app} label="With the app" divider />
            </div>
          ))}

          {/* Footer bar — the table's own call to action, so nobody has
              to scroll back up to act on what they just read. */}
          <div
            className="relative flex flex-col items-center gap-4 border-t border-(--lp2-ink)/8 px-5 py-6 text-center sm:flex-row sm:justify-between sm:text-left"
            style={{
              backgroundImage:
                'linear-gradient(to top, color-mix(in oklab, var(--lp2-tangerine) 16%, #fff), #fff)',
              borderBottomLeftRadius: CORNER,
              borderBottomRightRadius: CORNER,
            }}
          >
            <p className="text-sm font-semibold text-(--lp2-ink-soft)">
              Already on the app? Keep the same number — embedded signup
              migrates it to the API for you.
            </p>
            <Btn href="/signup" className="h-12 shrink-0 px-6 text-sm">
              Apply for the API — free
            </Btn>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Feature label + hint ────────────────────────────────────────── */

function Feature({
  name,
  hint,
  roundTopOnMobile,
}: {
  name: string;
  hint: string;
  roundTopOnMobile: boolean;
}) {
  // Ties the icon to its bubble for screen readers — the tooltip is only
  // visually hidden (opacity), so it stays in the accessibility tree.
  const hintId = `compare-hint-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`;

  return (
    <div
      className={cn(
        // No cream fill any more — the row is white and the recommended
        // column's wash is what separates the three.
        'relative flex items-center gap-1.5 px-5 py-3 sm:py-4',
        // Mobile-only: with the headings hidden, this cell is the card's
        // top-left corner. On desktop it sits under the heading row,
        // where a radius would notch it.
        roundTopOnMobile && 'max-sm:rounded-tl-[15px]'
      )}
    >
      <p className="text-sm font-semibold">{name}</p>

      {/* `peer` + a sibling tooltip rather than a group wrapper: the
          tooltip is anchored to the *cell*, not to the icon, so it can
          never hang off the side of the table however long the label
          in front of it runs. */}
      <button
        type="button"
        aria-label={`What "${name}" means`}
        aria-describedby={hintId}
        className="peer flex size-4 shrink-0 items-center justify-center rounded-full text-(--lp2-ink-soft) transition-colors hover:text-(--lp2-ink) focus-visible:text-(--lp2-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lp2-ink)"
      >
        <Info className="size-3.5" strokeWidth={2.75} />
      </button>

      <span
        id={hintId}
        role="tooltip"
        className="pointer-events-none absolute inset-x-4 bottom-full z-30 mb-1.5 rounded-xl border-2 border-(--lp2-ink) bg-(--lp2-ink) px-3 py-2 text-left text-xs leading-snug font-semibold text-white opacity-0 shadow-(--lp2-shadow-sm) transition-opacity duration-150 peer-hover:opacity-100 peer-focus-visible:opacity-100"
      >
        {hint}
      </span>
    </div>
  );
}

/* ─── Comparison cell ─────────────────────────────────────────────── */

function Value({
  text,
  tone,
  label,
  divider = false,
}: Cell & {
  /** Which column this is. Shown on mobile, where the stacked cells
   *  have no heading above them; screen-reader-only from `sm` up. */
  label: string;
  /** Rule on the left edge. Only the last column needs one — the
   *  recommended column is separated by its wash instead, and a border
   *  on top of that reads as a box drawn around the gradient. */
  divider?: boolean;
}) {
  const yes = tone === 'yes';

  return (
    <div
      className={cn(
        'relative flex items-start gap-2.5 border-t border-(--lp2-ink)/8 px-5 py-3 sm:border-t-0 sm:py-4',
        divider && 'sm:border-l'
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
          // "Yes" keeps the full green — it is the answer the table is
          // arguing for. "No" is mixed toward white: ten saturated
          // coral discs down one column read as an error state rather
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
      <span>
        <span className="block text-[10px] font-bold tracking-wide text-(--lp2-ink-soft) uppercase sm:sr-only">
          {label}
        </span>
        <span className="block text-sm leading-snug font-medium">{text}</span>
      </span>
    </div>
  );
}
