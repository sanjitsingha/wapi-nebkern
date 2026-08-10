import { cn } from '@/lib/utils';
import { SectionHead } from './ui';

// ============================================================
// What sets Instant apart — the numbers band.
//
// Sits between the testimonials and the FAQ, in the slot the pricing
// block used to hold: proof, then a one-glance summary, then the
// objections.
//
// Plain white, no wash. The card is already the loudest object in the
// section — ink outline, hard shadow, four display numerals — and a
// tinted band behind it gave the eye two edges to read before it got
// to any of them. White also keeps the run of sections honest: the
// testimonials above are white and the FAQ below opens on its own
// grape wash, so this one stays out of the way of both.
//
// WHY THESE NUMBERS AND NOT OUTCOME METRICS
//
// The obvious version of this section is four percentages — "89%
// higher CSAT", "133% agent efficiency". Those are claims about
// measured results across a customer base, and we do not have that
// data. Printing them would be inventing evidence on a page that asks
// people for money, and it is exactly the sort of claim a Meta partner
// review or a consumer-protection complaint picks up on.
//
// So every number here is STRUCTURAL — a fact about how the product is
// built, true on the day someone connects their number, and checkable
// against the docs:
//
//   3    → WhatsApp, Instagram and Messenger in one inbox (see faq.tsx)
//   1    → one number, unlimited seats (see compare.tsx, "Multi-user")
//   0%   → Meta bills you at Meta's published rates, no reseller cut
//   14   → the trial length, every feature included
//
// If real measured results ever exist, they belong here and this
// comment should be the thing that gets deleted. Until then these hold
// the same visual beat without the exposure.
// ============================================================

const STATS: {
  value: string;
  label: string;
  note: string;
  hue: string;
}[] = [
  {
    value: '3',
    label: 'Channels, one inbox',
    note: 'WhatsApp, Instagram, Messenger',
    hue: 'grass',
  },
  {
    value: '1',
    label: 'Number, unlimited seats',
    note: 'The whole team, same thread',
    hue: 'sky',
  },
  {
    value: '0%',
    label: 'Reseller markup',
    note: "Meta bills you at Meta's rates",
    hue: 'tangerine',
  },
  {
    value: '14',
    label: 'Days free',
    note: 'Every feature, no card',
    hue: 'grape',
  },
];

export function Lp2Apart() {
  return (
    <section id="apart" className="scroll-mt-28 bg-white py-20 sm:py-28">
      {/* `max-w-6xl` to match `compare` and `integrations`. The card is
          the thing people stop on, so it gets the page's full content
          width rather than the narrower measure a text section wants. */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead
          hue="grass"
          title="What sets Instant apart?"
          highlight="Instant"
          highlightText="white"
          subtitle="Four things that are true the day you connect your number — not projections, and nothing you have to upgrade to reach."
        />

        {/* The card carries the page's handwriting — 2px ink outline and
            a hard offset shadow — so it reads as one object rather than
            four numbers floating loose. The deeper `shadow-lg` variant
            because the box is large now: a 4px offset that reads as
            solid under a small card looks like a printing slip under
            one this size. */}
        <div className="mt-14 rounded-3xl border-2 border-(--lp2-ink) bg-white shadow-(--lp2-shadow-lg)">
          <div className="grid grid-cols-2 sm:grid-cols-4">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className={cn(
                  'flex flex-col items-center px-4 py-12 text-center sm:px-6 sm:py-16',
                  // Dashed rules rather than solid: at 20% ink a solid
                  // line still reads as structure dividing four cards,
                  // and the dash says "same object, four readings".
                  'border-dashed border-(--lp2-ink)/20',
                  // Two across on a phone — a four-column row would put
                  // these numbers at about 20px, which is no longer a
                  // headline number.
                  i % 2 === 1 ? 'border-l-2' : 'border-l-0',
                  i >= 2 ? 'border-t-2' : 'border-t-0',
                  // One row from `sm`: the second row's top rule goes,
                  // and every column but the first takes a left rule.
                  'sm:border-t-0',
                  i > 0 ? 'sm:border-l-2' : 'sm:border-l-0'
                )}
              >
                {/* A short hue bar instead of colouring the number. The
                    figure has to stay ink to keep its weight; the bar
                    is what stops the row reading as monochrome. */}
                <span
                  aria-hidden
                  className="mb-4 h-2 w-10 rounded-full"
                  style={{ backgroundColor: `var(--lp2-${s.hue})` }}
                />
                <p className="lp2-display text-5xl leading-none font-extrabold sm:text-6xl lg:text-7xl">
                  {s.value}
                </p>
                <p className="mt-4 text-sm leading-tight font-bold text-balance sm:mt-5 sm:text-lg">
                  {s.label}
                </p>
                <p className="mt-2 text-xs leading-snug text-balance text-(--lp2-ink-soft) sm:text-sm">
                  {s.note}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-base leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-lg">
          An official Meta Tech Provider, so you connect to Meta directly and
          pay Meta directly — no middleman on your messages.
        </p>
      </div>
    </section>
  );
}
