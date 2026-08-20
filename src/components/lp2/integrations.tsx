import Image from 'next/image';
import { ArrowRight, Check } from 'lucide-react';

import { Highlight } from './decor';
import { Btn } from './ui';

// ============================================================
// Integrations — the "does it fit the stack I already run?" section.
//
// Sits after the payoff section and before the comparison: the product
// story is finished by then, and this is the first practical objection
// a reader raises once they believe the thing works.
//
// Contained gradient panel, same treatment as `ai-agents`: colour held
// to the content column, strongest at the top edge, dissolving into the
// white section below rather than stopping on a border.
//
// COPY ACCURACY: docs/api-and-integrations says outright that there is
// no dedicated app in any marketplace yet — Zapier, Make and n8n are
// wired through outbound webhooks and the REST API like any other
// system. So the wording here is "through the API", never "one-click"
// or "native". That load is carried entirely by the body paragraph now
// that the artwork replaced the captioned tiles, so it has to keep
// saying it. If a real Shopify app ever ships, this section can promise
// more; until then it cannot.
// ============================================================

// Rising from the bottom, and lemon rather than sky: the payoff section
// directly above already puts a sky-washed card on the right-hand side,
// and two blues stacked read as one long band. Lemon is safe here — the
// section above uses it only for a small badge, and `apart` below lays
// no wash of its own.
//
// Held to 30% so it stays a wash. Lemon is a bright, high-value yellow;
// much past this it stops reading as a tint behind the panel and starts
// competing with the artwork sitting on it.
const PANEL_WASH =
  'linear-gradient(to top, color-mix(in oklab, var(--lp2-lemon) 30%, #fff), #fff 88%)';

/**
 * The orbit artwork: the Instant mark ringed by the systems it talks to.
 *
 * Served from the media host like the rest of the brand assets — it is
 * already covered by `next.config.ts`'s `images.remotePatterns` entry for
 * `/assets/**`, so a re-cut of the diagram is a file swap rather than a
 * deploy. (The filename's spelling is the asset's, not a typo here.)
 */
const ORBIT_ART = 'https://media.instant.nebkern.com/assets/intregation.png';

/** The asset's true pixel size — `next/image` needs the real ratio to
 *  reserve the box before the bytes land, or the panel reflows on first
 *  paint. It is square. */
const ORBIT_SIZE = 1000;

/** The events worth pushing a WhatsApp message about. Ordinary
 *  commerce moments on purpose — the point is that they already happen
 *  in a system you own, and this is what turns them into a message. */
const TRIGGERS = [
  'Abandoned cart, back in stock, price drop',
  'Order confirmed, packed, shipped, delivered',
  'Payment failed, refund issued, invoice due',
  'Form drop-off, demo booked, event reminder',
];

export function Lp2Integrations() {
  return (
    <section id="integrations" className="scroll-mt-28 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div
          className="grid items-center gap-14 rounded-3xl px-6 py-12 sm:px-10 sm:py-14 lg:grid-cols-2 lg:gap-16"
          style={{ backgroundImage: PANEL_WASH }}
        >
          {/* ── Copy ── */}
          <div>
            <h2 className="lp2-display text-3xl leading-[1.08] font-extrabold text-balance sm:text-[2.75rem]">
              Integrate your CRM with{' '}
              <Highlight color="sky" className="text-white">
                APIs
              </Highlight>
            </h2>

            <p className="mt-5 text-xl leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-2xl">
              Connect your CRM, payment portals and eCommerce platforms —
              Shopify, WooCommerce, HubSpot, Zapier — through the Instant REST
              API and outbound webhooks.
            </p>

            <p className="mt-5 text-xl leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-2xl">
              Then automate the message that should follow:
            </p>

            <ul className="mt-5 space-y-3">
              {TRIGGERS.map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-(--lp2-pop)">
                    <Check className="size-3.5" strokeWidth={4} />
                  </span>
                  <span className="text-sm leading-relaxed font-medium sm:text-base">
                    {t}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-9">
              {/* White rather than the solid-green primary: the panel is
                  washed green now, and a green button on it loses its
                  edge. */}
              <Btn href="/docs/api-and-integrations" variant="plain">
                View all integrations
                <ArrowRight className="size-5" strokeWidth={2.75} />
              </Btn>
            </div>
          </div>

          {/* ── The visual ── */}
          <AppOrbit />
        </div>
      </div>
    </section>
  );
}

function AppOrbit() {
  return (
    <div className="mx-auto w-full max-w-md lg:max-w-none">
      {/* No `priority`: this sits well below the fold, so it should stay
          lazy and leave the hero's budget alone. */}
      <Image
        src={ORBIT_ART}
        alt="The Instant mark ringed by Shopify, Make, Zoho, Google Sheets, Zapier and a REST API badge"
        width={ORBIT_SIZE}
        height={ORBIT_SIZE}
        sizes="(min-width: 1024px) 36rem, (min-width: 640px) 28rem, 100vw"
        // The house card treatment — ink border, hard offset shadow,
        // same rounding as the panels in `apart` and `pricing-page`.
        // `bg-white` matters: the PNG has an alpha channel, so without
        // it the yellow wash would show through and the card would read
        // as a tinted pane rather than a white one.
        className="h-auto w-full rounded-3xl border-2 border-(--lp2-ink) bg-white shadow-(--lp2-shadow-lg)"
      />
    </div>
  );
}
