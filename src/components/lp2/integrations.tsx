import {
  ArrowRight,
  Check,
  CreditCard,
  ShoppingBag,
  ShoppingCart,
  Users,
  Webhook,
  Workflow,
  Zap,
} from 'lucide-react';

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
// or "native", and the tiles carry that caption. If a real Shopify app
// ever ships, this section can promise more; until then it cannot.
// ============================================================

// Rising from the bottom, and green rather than sky: the payoff section
// directly above already puts a sky-washed card on the right-hand side,
// and two blues stacked read as one long band. Grass is the brand green
// and is clear of `lemon` above and `tangerine` below.
const PANEL_WASH =
  'linear-gradient(to top, color-mix(in oklab, var(--lp2-grass) 26%, #fff), #fff 88%)';

const APPS = [
  { name: 'Shopify', hue: 'grass', icon: ShoppingBag, white: true },
  { name: 'WooCommerce', hue: 'grape', icon: ShoppingCart, white: true },
  { name: 'HubSpot', hue: 'tangerine', icon: Users },
  { name: 'Zapier', hue: 'lemon', icon: Zap },
  { name: 'Make', hue: 'sky', icon: Workflow, white: true },
  { name: 'Razorpay', hue: 'coral', icon: CreditCard, white: true },
] as const;

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

            <p className="mt-5 text-base leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-lg">
              Connect your CRM, payment portals and eCommerce platforms —
              Shopify, WooCommerce, HubSpot, Zapier — through the Instant REST
              API and outbound webhooks.
            </p>

            <p className="mt-5 text-base leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-lg">
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
          <AppGrid />
        </div>
      </div>
    </section>
  );
}

function AppGrid() {
  return (
    <div className="mx-auto w-full max-w-md lg:max-w-none">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {APPS.map((app) => (
          <div
            key={app.name}
            className="flex flex-col items-center gap-2.5 rounded-xl border-2 border-(--lp2-ink) bg-white px-3 py-4 text-center"
          >
            <span
              className="flex size-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: `var(--lp2-${app.hue})` }}
            >
              {/* White glyph on the deeper hues, ink on the pale ones —
                  `lemon` and `tangerine` are nowhere near dark enough to
                  carry white. */}
              <app.icon
                className={
                  'white' in app && app.white ? 'size-5 text-white' : 'size-5'
                }
                strokeWidth={2.75}
              />
            </span>
            <span className="text-xs leading-tight font-bold">{app.name}</span>
          </div>
        ))}
      </div>

      {/* What actually does the connecting. Stated plainly under the
          logos rather than left implied, because the tiles above are the
          part a reader will over-read. */}
      <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border-2 border-(--lp2-ink) bg-(--lp2-lemon) px-4 py-3 text-center">
        <Webhook className="size-4 shrink-0" strokeWidth={3} />
        <span className="text-xs font-extrabold">
          Connected with the REST API &amp; outbound webhooks
        </span>
      </div>
    </div>
  );
}
