import { ArrowRight } from 'lucide-react';

import { Highlight } from './decor';
import { Btn } from './ui';

// ============================================================
// The pricing beat — the claim, the number, and the way out to /pricing.
//
// WHY THIS EXISTS AT ALL
//
// The full plan comparison is deliberately off this page; plans live on
// /pricing, linked from the nav and the footer. That still stands —
// there is no table here and no tiers. What this recovers is the
// *claim*: "one flat fee, never per message" is the reason someone
// picks us over a reseller, since nearly every competitor sits between
// the customer and Meta and takes a cut of each conversation.
//
// WHY THERE IS NOW A NUMBER
//
// The layout is modelled on a reference where the large figure is a
// per-message rate. Copying that literally would have argued against
// us: a giant "per message" number is the exact thing this section
// exists to say we do not charge. So the slot holds the entry plan
// price instead, and the unit line under it reads PER MONTH. Same
// shape, opposite and correct argument.
//
// ⚠ ₹100 is duplicated from `pricing.tsx` (and `pricing-page.tsx`,
// which already had its own copy). If plan pricing changes, all three
// have to move together — grep for the figure rather than trusting
// this comment.
//
// WHY HERE
//
// After the numbers band and before the FAQ. Everything above is
// argument; everything below is doubt-clearing and the closing ask.
// Cost is the last thing a convinced reader wants confirmed, and the
// first thing they will otherwise go hunting for in the nav — which
// takes them off this page mid-scroll.
//
// WHY IT LOOKS LIKE THIS
//
// Cream, not white: it is bracketed by <Lp2Apart> on white above and
// the FAQ's grape wash below, and a white band between them would read
// as the bottom of the section above rather than as its own beat.
// ============================================================

/** Entry plan, mirrored from `pricing.tsx`. See the warning above. */
const STARTING_PRICE = '₹100';

export function Lp2PricingNote() {
  return (
    <section className="bg-(--lp2-cream) py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto] lg:gap-20">
          {/* Left: eyebrow, claim, copy, way out */}
          <div>
            <p className="text-sm font-bold tracking-[0.14em] text-(--lp2-ink-soft) uppercase">
              Pricing
            </p>

            {/* Same sentence as the /pricing hero, deliberately. The page
                a visitor lands on next should open with the line that
                sent them there, or the click feels unanswered. */}
            <h2 className="lp2-display mt-5 text-3xl leading-[1.1] font-extrabold text-balance sm:text-[2.5rem]">
              One flat fee. <Highlight color="lemon">Never</Highlight> per
              message.
            </h2>

            <p className="mt-5 max-w-2xl text-xl leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-2xl">
              Most WhatsApp platforms sit between you and Meta and take a cut of
              every conversation. We don&rsquo;t sit there at all — your
              messages are billed by Meta, to you, at Meta&rsquo;s rates.
            </p>

            {/* `plain`, not `primary`. Every other CTA on this page points
                at /signup in solid green; this one points sideways to
                /pricing, and dressing it identically would put two equal
                green buttons on the same scroll competing for the click
                that matters. */}
            <div className="mt-8">
              <Btn href="/pricing" variant="plain">
                See the plans
                <ArrowRight className="size-5" />
              </Btn>
            </div>
          </div>

          {/* Right: the figure. Left-aligned rather than centred so the
              rupee sign, the number and the unit line all share one edge
              — centring a currency figure leaves the symbol floating. */}
          <div className="lg:text-left">
            <p className="text-lg text-(--lp2-ink-soft)">Starting at</p>

            <p className="lp2-display mt-1 text-6xl leading-none font-extrabold tabular-nums sm:text-7xl">
              {STARTING_PRICE}
            </p>

            <p className="mt-3 text-sm font-bold tracking-[0.14em] text-(--lp2-ink-soft) uppercase">
              Per month
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
