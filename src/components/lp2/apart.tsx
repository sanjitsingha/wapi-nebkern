import { cn } from '@/lib/utils';
import { SectionHead } from './ui';

// ============================================================
// What sets Instant apart — the numbers band.
//
// Sits between the testimonials and the FAQ, in the slot the pricing
// block used to hold: proof, then a one-glance summary, then the
// objections. Washed green at the top and gone by the bottom, so it
// hands off into the FAQ's grape without a seam.
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
    <section
      id="apart"
      className="scroll-mt-28 py-20 sm:py-28"
      style={{
        backgroundImage:
          'linear-gradient(to bottom, color-mix(in oklab, var(--lp2-pop) 20%, #fff), #fff 88%)',
      }}
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHead
          hue="grass"
          title="What sets Instant apart?"
          highlight="Instant"
          highlightText="white"
          subtitle="Four things that are true the day you connect your number — not projections, and nothing you have to upgrade to reach."
        />

        {/* The card carries the page's handwriting — 2px ink outline and
            a hard offset shadow — so it reads as one object rather than
            four numbers floating on the wash. */}
        <div className="mt-12 rounded-3xl border-2 border-(--lp2-ink) bg-white shadow-(--lp2-shadow)">
          <div className="grid grid-cols-2 sm:grid-cols-4">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className={cn(
                  'flex flex-col items-center px-4 py-8 text-center sm:px-5',
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
                  className="mb-3 h-1.5 w-8 rounded-full"
                  style={{ backgroundColor: `var(--lp2-${s.hue})` }}
                />
                <p className="lp2-display text-4xl leading-none font-extrabold sm:text-5xl">
                  {s.value}
                </p>
                <p className="mt-3 text-sm leading-tight font-bold text-balance sm:text-base">
                  {s.label}
                </p>
                <p className="mt-1.5 text-xs leading-snug text-balance text-(--lp2-ink-soft)">
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
