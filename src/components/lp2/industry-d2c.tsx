import Image from 'next/image';
import {
  ArrowRight,
  BadgeIndianRupee,
  MessageCircle,
  PackageCheck,
  RotateCcw,
  Sparkles,
  Truck,
} from 'lucide-react';

import { FeatureGrid, FeatureSplit, FeatureTrio } from './feature-page';
import { Btn } from './ui';

// ============================================================
// /industries/d2c-ecommerce
//
// The first industry page. Built from the shared feature-page blocks
// so it reads as part of the set rather than a one-off, with its own
// hero because the artwork does something the FeatureHero cannot.
//
// Every claim here is one the product already makes elsewhere on the
// site — shared inbox, Maya, campaigns, automations, pipelines, the
// REST API and webhooks. Nothing is invented for the pitch, and no
// outcome numbers appear: there is no data behind "recovers 30% of
// carts" and a page that claims it is a page that has to defend it.
// ============================================================

/**
 * Hero.
 *
 * The artwork is a 1600x600 banner with the subject on the left and
 * empty teal on the right, which is what makes an overlay unnecessary:
 * the copy sits on the empty half.
 *
 * `object-right` below lg, `object-left` from lg. That inversion is
 * the whole trick. On a phone the frame crops tight, so anchoring
 * right keeps the empty teal under the words; on a wide screen
 * anchoring left keeps the person in shot and leaves the right side
 * clear for them. Without it, one end or the other puts white text on
 * a face.
 */
export function D2cHero() {
  return (
    <section className="relative -mt-19 flex min-h-[70vh] items-center overflow-hidden bg-[#0d3d42] pt-19 sm:-mt-20 sm:pt-20">
      {/* `alt=""` — decorative. The headline in front of it says what
          the page is about; describing the photograph as well would
          only make a screen reader say it twice. */}
      <Image
        src="/images/industries/d2c-hero.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-right lg:object-left"
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="ml-auto max-w-xl text-white lg:max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3.5 py-1.5 text-xs font-bold backdrop-blur-sm">
            <Sparkles className="size-3.5" />
            D2C &amp; eCommerce
          </span>

          <h1 className="lp2-display mt-6 text-4xl leading-[1.08] font-extrabold text-balance sm:text-5xl">
            Your customers already bought in the chat. Sell there too.
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-pretty text-white/80 sm:text-xl">
            The enquiry, the order, the &ldquo;where is my parcel&rdquo; and the
            next sale all happen in the same thread. Instant keeps them there —
            one number, your whole team, and an AI that answers while you sleep.
          </p>

          <div className="mt-9">
            <Btn href="/signup">
              Start free trial — 14 days
              <ArrowRight className="size-5" strokeWidth={2.75} />
            </Btn>
          </div>
        </div>
      </div>
    </section>
  );
}

export function D2cTrio() {
  return (
    <FeatureTrio
      hue="lemon"
      points={[
        {
          icon: RotateCcw,
          title: 'Carts that come back',
          body: 'An abandoned checkout triggers a follow-up in the thread the customer already uses — not an email they will not open.',
        },
        {
          icon: Truck,
          title: 'Order updates that land',
          body: 'Confirmations, dispatch and delivery go out on WhatsApp, where they are read. Fewer "where is my parcel" tickets to answer.',
        },
        {
          icon: MessageCircle,
          title: 'One inbox, whole team',
          body: 'WhatsApp, Instagram and Messenger in one place, with every past order and message on the contact before anyone replies.',
        },
      ]}
    />
  );
}

export function D2cAutomations() {
  return (
    <FeatureSplit
      hue="lemon"
      title="The follow-up nobody has time to send"
      highlight="nobody has time"
      body="Your store knows when a cart is abandoned, an order ships, or a customer has not bought in ninety days. Instant turns each of those into a message that goes out on its own."
      points={[
        'Trigger a flow from your own store through the REST API or an outbound webhook',
        'Shopify, WooCommerce, HubSpot and Zapier on the same connection',
        'Pace the sends, handle opt-outs, and stop the moment someone replies',
        'Every automated message lands in the same thread as the human ones',
      ]}
      visual={
        <div className="space-y-3 rounded-2xl border-2 border-(--lp2-ink) bg-white p-5 shadow-(--lp2-shadow-sm)">
          {[
            { label: 'Cart abandoned', detail: 'wait 1 hour → send reminder' },
            { label: 'Order shipped', detail: 'send tracking link' },
            { label: 'No order in 90 days', detail: 'send a win-back offer' },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 rounded-xl border-2 border-(--lp2-ink)/15 bg-(--lp2-cream) px-4 py-3"
            >
              <span className="text-sm font-extrabold">{row.label}</span>
              <span className="text-xs font-medium text-(--lp2-ink-soft)">
                {row.detail}
              </span>
            </div>
          ))}
        </div>
      }
    />
  );
}

export function D2cMaya() {
  return (
    <FeatureSplit
      hue="maya"
      flip
      tint
      title="Maya answers the questions you answer every day"
      highlight="every day"
      body="Sizing, shipping times, returns, what is in stock. Maya replies from your own catalogue and policies, around the clock, and hands the conversation to a person the moment it needs one."
      points={[
        'Trained on your own docs, catalogues and FAQs — not generic answers',
        'Replies in seconds, at 2am, in the thread the customer is already in',
        'Hands off to your team when it cannot answer safely',
        'Included from ₹799/mo, with no per-message AI fee',
      ]}
      visual={
        <div className="space-y-2.5 rounded-2xl border-2 border-(--lp2-ink) bg-white p-5 shadow-(--lp2-shadow-sm)">
          {[
            { side: 'in', text: 'Is the blue kurta back in size M?' },
            { side: 'out', text: 'It is — restocked yesterday. Shall I send the link?' },
            { side: 'in', text: 'Yes please' },
          ].map((m) => (
            <p
              key={m.text}
              className={
                m.side === 'in'
                  ? 'max-w-[85%] rounded-2xl rounded-bl-sm bg-(--lp2-cream) px-4 py-2.5 text-sm font-medium'
                  : 'ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-(--lp2-maya-soft) px-4 py-2.5 text-sm font-medium'
              }
            >
              {m.text}
            </p>
          ))}
        </div>
      }
    />
  );
}

export function D2cGrid() {
  return (
    <FeatureGrid
      hue="lemon"
      title="Everything else a store runs on"
      highlight="a store runs on"
      subtitle="The rest of the product, in the places a D2C team actually meets it."
      items={[
        {
          title: 'Segments that mean something',
          body: 'Group contacts by what they bought, what they spent, or when they last ordered, and send to that group alone.',
        },
        {
          title: 'Campaigns with real numbers',
          body: 'Approved templates to a segment, personalised per recipient, with sent, delivered, read and replied counted.',
        },
        {
          title: 'A pipeline for the big orders',
          body: 'Bulk and wholesale enquiries move through your own stages, with the whole chat inside the deal.',
        },
        {
          title: 'Click-to-WhatsApp ads',
          body: 'Meta Ads connected, so an ad click opens a conversation that lands in the same inbox as everything else.',
        },
        {
          title: 'Catalogue in the thread',
          body: 'Send products, buttons and link CTAs instead of plain text, so buying is one tap rather than a copied URL.',
        },
        {
          title: 'Your number, your bill',
          body: 'You connect on your own WhatsApp Business Account. Meta bills you directly, at Meta’s published rates.',
        },
      ]}
    />
  );
}

/** A short strip of the facts, mirroring the one on the landing page. */
export function D2cFacts() {
  return (
    <section className="bg-(--lp2-ink) py-16 text-white sm:py-20">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:grid-cols-3 sm:px-6">
        {[
          {
            icon: BadgeIndianRupee,
            stat: '0%',
            label: 'Reseller markup',
            body: 'Meta bills you at Meta’s own rates.',
          },
          {
            icon: PackageCheck,
            stat: '3',
            label: 'Channels, one inbox',
            body: 'WhatsApp, Instagram and Messenger.',
          },
          {
            icon: Sparkles,
            stat: '14',
            label: 'Days free',
            body: 'Every feature, no card required.',
          },
        ].map((f) => (
          <div key={f.label}>
            <f.icon className="size-5 text-white/60" strokeWidth={2.25} />
            <p className="mt-4 text-[44px] leading-none font-extrabold tracking-[-0.02em]">
              {f.stat}
            </p>
            <p className="mt-3 text-base font-extrabold">{f.label}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-white/60">
              {f.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
