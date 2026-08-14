import { ArrowRight } from 'lucide-react';

import { Highlight } from './decor';
import { Btn } from './ui';

// ============================================================
// The pricing note — one line, not the pricing section.
//
// WHY THIS EXISTS AT ALL
//
// The full plan comparison was deliberately taken off this page; plans
// live on /pricing, linked from the nav and the footer. That decision
// stands, and this does not reverse it: there is no table here, no
// tiers, no numbers to keep in step with the billing code.
//
// What it recovers is the *claim*. "One flat fee, never per message" is
// the reason someone picks us over a reseller — nearly every competitor
// sits between the customer and Meta and takes a cut of each
// conversation. Once the pricing section left, that claim survived on
// this page only as one tile of four inside the numbers band, reading
// "0% reseller markup". That is the differentiator stated as a
// footnote. A visitor deciding between us and a reseller should not
// have to parse a four-up of stats to find it.
//
// WHY HERE
//
// After the numbers band and before the FAQ. Everything above this
// point has been argument; everything below is doubt-clearing and the
// closing ask. Cost is the last thing a convinced reader wants
// confirmed before they start reading the FAQ with their wallet in
// mind — and the first thing they will otherwise go looking for in the
// nav, which takes them off this page mid-scroll.
//
// WHY IT LOOKS LIKE THIS
//
// Cream, not white: it is bracketed by <Lp2Apart> on white above and
// the FAQ's grape wash below, and a white band between them would read
// as the bottom of the section above rather than as its own beat.
//
// Compact padding (py-14 against the page's usual py-20/28) and a
// single bordered card is the whole design. This is a note. Sized like
// the sections around it, it would start competing with them, and the
// argument it is a postscript to would be the thing that lost.
// ============================================================

export function Lp2PricingNote() {
  return (
    <section className="bg-(--lp2-cream) py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-6 rounded-3xl border-2 border-(--lp2-ink) bg-white px-6 py-8 text-center shadow-(--lp2-shadow-lg) sm:px-10 lg:flex-row lg:justify-between lg:text-left">
          <div>
            {/* Same sentence as the /pricing hero, deliberately. The
                page a visitor lands on next should open with the line
                that sent them there, or the click feels unanswered. */}
            <h2 className="lp2-display text-2xl leading-[1.1] font-extrabold text-balance sm:text-3xl">
              One flat fee. <Highlight color="lemon">Never</Highlight> per
              message.
            </h2>
            <p className="mt-3 max-w-xl text-sm text-pretty text-(--lp2-ink-soft) sm:text-base">
              Most WhatsApp platforms sit between you and Meta and take a cut of
              every conversation. We don&rsquo;t sit there at all — your
              messages are billed by Meta, to you, at Meta&rsquo;s rates.
            </p>
          </div>

          {/* `plain`, not `primary`. Every other CTA on this page points
              at /signup in solid green; this one points sideways to
              /pricing, and dressing it identically would put two equal
              green buttons on the same scroll competing for the click
              that matters. */}
          <Btn href="/pricing" variant="plain" className="shrink-0">
            See the plans
            <ArrowRight className="size-5" />
          </Btn>
        </div>
      </div>
    </section>
  );
}
