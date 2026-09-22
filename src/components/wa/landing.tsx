import { unstable_cache } from 'next/cache';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check, CheckCheck, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';

import { hardShadowButton } from '@/components/lp2/ui';
import { Magnetic, MagneticButton } from '@/components/ui/magnetic-button';
import { formatPostDate, getPublishedPosts } from '@/lib/blog';
import { cn } from '@/lib/utils';
import { SAMPLE_BLOG_CARDS, WaBlogRail, type WaBlogCardItem } from './blog-rail';
import { WaFeatureCarousel } from './feature-carousel';
import { WaHeroChat } from './hero-chat';
import { WaStatsTabs, type WaStat } from './stats-tabs';
import { WaPill, waType } from './ui';

// ============================================================
// The landing page in the WhatsApp design (whatsapp.design.md).
//
// Same product, same claims, same numbers as the playful landing — the
// copy is lifted from components/lp2 so the two designs never disagree
// about what Instant does. Only the design language changes:
//
//   - warm cream floor, near-black ink, weight 400 at every size;
//   - a 25px "photograph" tile for the hero with the headline in white
//     over it, and contact chips drifting around its edge;
//   - flat white tiles, pill buttons, no shadows, no gradients;
//   - exactly one pure-black band, carrying the "direct to Meta" story
//     the way whatsapp.com's band carries encryption;
//   - the voltage-green pill four times, all on the signup action.
//
// There is no photography in this repo (public/hero-avatars is a README),
// so the hero tile is a chat-wallpaper illustration with a live-looking
// conversation instead of a photo of one.
// ============================================================

const META_LOGO = 'https://media.instant.nebkern.com/assets/meta-logo.png';
const ORBIT_ART = 'https://media.instant.nebkern.com/assets/intregation.png';

/** Which hero to render. `centered` is the live design; `chat` is the
 *  earlier chat-bubble hero, still reachable at /?hero=chat. */
export type WaHeroVariant = 'chat' | 'centered';

export function WaLanding({ hero = 'centered' }: { hero?: WaHeroVariant }) {
  return (
    <>
      {hero === 'centered' ? <HeroCentered /> : <Hero />}
      <Industries />
      <WaFeatureCarousel />
      <Compare />
      <StatsBand />
      <Maya />
      <Integrations />
      <Showcase />
      <PricingNote />
      <Faq />
      <ClosingCta />
      {/* Last, straight above the footer: reading material for whoever
          scrolled past the call to action without taking it. */}
      <RecentPosts />
    </>
  );
}

/* ─── Shared bits ─────────────────────────────────────────────────── */

function Section({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn('scroll-mt-24 px-6 py-20 sm:py-24', className)}>
      {children}
    </section>
  );
}

function Heading({
  title,
  subtitle,
  size = 'lg',
  className,
}: {
  /** A node, not just a string, so a caller can highlight a word —
   *  the same green box the hero puts around `@conversation`. */
  title: React.ReactNode;
  subtitle?: string;
  size?: 'lg' | 'md';
  className?: string;
}) {
  return (
    <div className={cn('mx-auto max-w-[900px] text-center', className)}>
      <h2 className={cn(size === 'lg' ? waType.displayLg : waType.displayMd, 'text-balance')}>
        {title}
      </h2>
      {subtitle && (
        <p className={cn(waType.bodyLg, 'mx-auto mt-6 max-w-[680px] text-pretty text-(--wa-ink-muted)')}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

/** Outgoing bubbles are the spec's mint; incoming are white. */
function Bubble({ side, text, time }: { side: 'in' | 'out'; text: string; time?: string }) {
  const out = side === 'out';
  return (
    <div className={cn('flex', out ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          waType.bodyMd,
          'max-w-[85%] rounded-[20px] px-3.5 py-2 text-(--wa-ink)',
          out ? 'bg-(--wa-mint)' : 'bg-white',
        )}
      >
        <p className="text-pretty">{text}</p>
        {time && (
          <p className={cn(waType.caption, 'mt-1 flex items-center justify-end gap-1 text-(--wa-ink-muted)')}>
            {time}
            {out && <CheckCheck className="size-3.5 text-[#53bdeb]" aria-label="Read" />}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Hero ────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="px-2.5 pt-8 pb-16 sm:pt-12 sm:pb-20">
      {/* The section runs edge to edge, 10px in from each side. The words
          and the conversation still sit on the nav's content column (see
          the max-width on the grid below), so on a wide screen they do
          not drift out to the corners. */}
      <div>
        {/* An open hero on the page's own cream — no tile behind it. Ink
            headline on the left, the conversation on the right. */}
        <div className="relative">
          {/* 1328px = the nav's 1232px content column plus this box's own
              48px side padding, so the headline starts exactly under the
              logo on a wide screen. */}
          <div className="relative mx-auto grid max-w-[1328px] items-center gap-12 px-6 py-14 sm:px-12 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
            {/* A size container, so the headline can be sized against this
                column's width rather than the viewport's. */}
            <div className="@container">
              {/* "Turn @conversation" always shares one line, with "into
                  revenue" under it. That line runs about 8.9em wide in
                  Manrope, so the font is sized in container units
                  (10.7cqw) to fill ~96% of the column at any width,
                  capped at 72px on large screens and floored at 24px on
                  the narrowest phones. Nowrap, so re-measure if
                  --font-sans changes. (9.3em / 10.2cqw in Inter.) */}
              <h1 className="text-[clamp(1.5rem,10.7cqw,4.5rem)] leading-[1.08] tracking-[-0.02em] text-(--wa-ink)">
                <span className="whitespace-nowrap">
                  Turn{' '}
                  {/* The highlighted word, styled like a mention: green text
                      on a light mint box. Its corner radius is an arbitrary
                      value on purpose: whatsapp.css turns the rounded-lg-style
                      token classes into 25px tiles, far too round here. The
                      box is a step deeper than the spec's mint (#e6ffda) so
                      it holds its own against the cream page, edged with a
                      1px border in a deeper green still. */}
                  <span className="rounded-[0.14em] border border-[#1fae55] bg-[#d4f5c6] px-[0.12em] text-(--wa-green)">
                    @conversation
                  </span>
                </span>
                <br />
                into revenue
              </h1>
              <p className={cn(waType.bodyLg, 'mt-7 max-w-[580px] text-pretty text-(--wa-ink-muted)')}>
                One shared inbox for your team. AI that responds instantly.
                Automated follow-ups that keep every lead moving towards a sale.
              </p>
              <div className="mt-9 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                <Magnetic radius="full">
                  <WaPill href="/signup" variant="primary">
                    Start free — 14 days
                  </WaPill>
                </Magnetic>
              </div>
            </div>

            <WaHeroChat />
          </div>
        </div>

        {/* The credential, beneath the hero. */}
        <p className={cn(waType.bodyMd, 'mt-10 flex flex-wrap items-center justify-center gap-3 text-(--wa-ink-muted)')}>
          <Image src={META_LOGO} alt="" width={124} height={25} priority className="h-5 w-auto" />
          Official Meta Tech Provider · built on the WhatsApp Business API
        </p>
      </div>
    </section>
  );
}


/**
 * Alternative hero — one centred column, no conversation panel.
 *
 * The live hero, rendered on /. The chat-bubble Hero above is kept and
 * still reachable at /?hero=chat (see app/(marketing)/page.tsx). Same
 * paragraph as Hero;
 * the headline is the longer "Turn every WhatsApp @conversation into
 * ₹revenue" over two lines, the button is the nav's outline Start free,
 * and there is no Meta credential line.
 */
function HeroCentered() {
  return (
    <section className="px-6 pt-24 pb-24 sm:pt-36 sm:pb-32">
      {/* A size container, so the headline can be sized against this
          column's width rather than the viewport's. */}
      <div className="@container mx-auto flex max-w-[980px] flex-col items-center text-center">
        {/* Two lines, always: "Turn every WhatsApp", then "@conversation
            into ₹revenue" held together with whitespace-nowrap. That second
            line runs about 13.1em in Manrope, so the font is sized in
            container units (7.3cqw) to fill ~96% of the column at any
            width, capped at 72px and floored at 20px for the narrowest
            phones. Re-measure both numbers if --font-sans changes: the
            line is whitespace-nowrap, so a wider face does not wrap, it
            overflows the column. (It was 13.8em / 6.9cqw in Inter.)

            Leading is 1.45, looser than a display headline's usual ~1.1:
            the second line's two chips carry their own padding and a 1px
            border, so at tight leading they crowd the line above. The
            extra air is what keeps the two rows reading as separate.

            Two words styled like mentions: "@conversation" in the same
            green as the live hero's, "₹revenue" in a yellow counterpart.
            Corner radii are arbitrary values on purpose — whatsapp.css
            turns the rounded-lg-style token classes into 25px tiles. */}
        <h1 className="text-[clamp(1.25rem,7.3cqw,4.5rem)] leading-[1.45] tracking-[-0.02em] text-(--wa-ink)">
          Turn every WhatsApp
          <br />
          <span className="whitespace-nowrap">
            <span className="rounded-[0.14em] border border-[#1fae55] bg-[#d4f5c6] px-[0.12em] text-(--wa-green)">
              @conversation
            </span>{' '}
            into{' '}
            <span className="rounded-[0.14em] border border-[#d9a400] bg-[#fff1b8] px-[0.12em] text-[#b27d00]">
              ₹revenue
            </span>
          </span>
        </h1>
        <p className={cn(waType.bodyLg, 'mt-7 max-w-[600px] text-pretty text-(--wa-ink-muted)')}>
          One shared inbox for your team. AI that responds instantly.
          Automated follow-ups that keep every lead moving towards a sale.
        </p>
        <div className="mt-9">
          {/* Same button as the nav's Start free — see hardShadowButton. */}
          <Magnetic>
            <Link href="/signup" className={hardShadowButton}>
              Start free — 14 days
              <ArrowRight className="size-4" strokeWidth={2.5} />
            </Link>
          </Magnetic>
        </div>
      </div>
    </section>
  );
}

/* ─── Industries ──────────────────────────────────────────────────── */

const INDUSTRIES = [
  'D2C & eCommerce', 'Clinics & Healthcare', 'Coaching & EdTech', 'Real Estate',
  'Travel & Tourism', 'Salons & Spas', 'Gyms & Fitness', 'Automobile',
  'Fashion & Apparel', 'Restaurants & Cafés', 'Jewellery', 'Pharmacy',
  'Logistics & Delivery', 'Interiors & Furniture', 'Finance & Insurance', 'Events & Photography',
];

function Industries() {
  return (
    <Section className="pt-6 sm:pt-8">
      <div className="mx-auto max-w-[1080px] text-center">
        <p className={cn(waType.bodyLg, 'text-(--wa-ink-muted)')}>
          Built for every business that sells over chat
        </p>
        <ul className="mt-7 flex flex-wrap justify-center gap-2.5">
          {INDUSTRIES.map((name) => (
            <li key={name}>
              {/* Magnetic: the chip leans towards the pointer, and a dashed
                  green field marks where it came from. A gentler pull than
                  the component's defaults (0.8, up to 100px) — these sit
                  shoulder to shoulder, so a 14px lean is enough to feel
                  alive without landing on a neighbour. Not links, so the
                  pointer stays an arrow. */}
              <MagneticButton
                strength={0.35}
                maxDistance={14}
                className="cursor-default rounded-full [--show-color:var(--wa-green)]"
              >
                <span
                  className={cn(
                    waType.bodyMd,
                    'block rounded-full border border-(--wa-hairline) bg-white px-4 py-2 text-(--wa-ink)',
                  )}
                >
                  {name}
                </span>
              </MagneticButton>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* ─── Features ────────────────────────────────────────────────────── */

// A horizontal card rail — see feature-carousel.tsx. It lives in its own
// client file because the arrow buttons track the rail's scroll position.

/* ─── Compare ─────────────────────────────────────────────────────── */

const ROWS: { feature: string; api: string; app: string; appYes?: boolean }[] = [
  { feature: 'Broadcast limit', api: 'Unlimited contacts per campaign', app: 'Up to 256 contacts a day' },
  { feature: 'Broadcast reach', api: 'Everyone who opted in', app: 'Only people who saved your number' },
  { feature: 'Multi-user access', api: 'Unlimited team members, one shared inbox', app: 'One phone plus four linked devices' },
  { feature: 'Automated messaging', api: 'AI agents, flows and no-code automations', app: 'Greeting and away messages only' },
  { feature: 'Coding required', api: 'None — Instant is the no-code layer', app: 'None — it is just an app', appYes: true },
  { feature: 'Verified green tick', api: 'Eligible once your business is verified', app: 'Not available' },
  { feature: 'Clickable messages', api: 'Buttons, quick replies and link CTAs', app: 'Plain text only' },
  { feature: 'Campaign analytics', api: 'Sent, delivered, read, replied and clicked', app: 'No campaign reporting' },
  { feature: 'CRM & integrations', api: 'Built-in CRM, REST API and webhooks', app: 'Not possible' },
  { feature: 'Remarketing', api: 'Segments, tags and automatic follow-ups', app: 'Not possible' },
];

function Compare() {
  return (
    <Section id="compare">
      <Heading
        size="md"
        title="The WhatsApp Business app, or the API?"
        subtitle="Every row is a limit the free app imposes and the API does not — plus the one thing the app genuinely does as well."
      />
      <div className="mx-auto mt-14 grid max-w-[1080px] gap-4 lg:grid-cols-2">
        <CompareTile side="api" />
        <CompareTile side="app" />
      </div>
      <p className={cn(waType.bodyLg, 'mx-auto mt-10 max-w-[680px] text-center text-pretty text-(--wa-ink-muted)')}>
        Already on the app? Keep the same number — embedded signup migrates it
        to the API for you.
      </p>
    </Section>
  );
}

function CompareTile({ side }: { side: 'api' | 'app' }) {
  const api = side === 'api';
  // `lp2-hard-shadow` is the opt-out from whatsapp.css's blanket
  // `box-shadow: none !important` — without it the shadow is stripped.
  return (
    <div className="lp2-hard-shadow rounded-[25px] bg-white p-7 shadow-[4px_4px_0_2px_rgba(0,0,0,0.05)] sm:p-8">
      <p className={cn(waType.caption, 'tracking-wide text-(--wa-ink-muted) uppercase')}>
        {api ? 'With Instant — growing teams' : 'The free app — small businesses'}
      </p>
      <h3 className="mt-2 text-[28px] leading-[32px] text-(--wa-ink)">
        {api ? 'WhatsApp Business API' : 'WhatsApp Business app'}
      </h3>
      <ul className="mt-6 divide-y divide-(--wa-hairline)">
        {ROWS.map((r) => {
          const yes = api || !!r.appYes;
          return (
            <li key={r.feature} className="flex items-start gap-3 py-3">
              <span
                className={cn(
                  'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
                  yes ? 'bg-(--wa-mint)' : 'bg-(--wa-tint)',
                )}
              >
                {yes ? (
                  <Check className="size-3.5 text-(--wa-ink)" strokeWidth={2.5} aria-label="Yes" />
                ) : (
                  <X className="size-3.5 text-(--wa-ink-muted)" strokeWidth={2.5} aria-label="No" />
                )}
              </span>
              <span className="min-w-0">
                <span className={cn(waType.caption, 'block text-(--wa-ink-muted)')}>{r.feature}</span>
                <span className={cn(waType.bodyMd, 'block', yes ? 'text-(--wa-ink)' : 'text-(--wa-ink-muted)')}>
                  {api ? r.api : r.app}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {api && (
        <div className="mt-7">
          {/* Same button as the nav's Start free — see hardShadowButton. */}
          <Magnetic>
            <Link href="/signup" className={hardShadowButton}>
              Apply for the API — free
              <ArrowRight className="size-4" strokeWidth={2.5} />
            </Link>
          </Magnetic>
        </div>
      )}
    </div>
  );
}

/* ─── The black band ──────────────────────────────────────────────── */

/** The structural facts from lp2/apart.tsx — true on the day someone
 *  Each href is the closest existing page, not a dedicated one: the
 *  billing numbers point at /pricing and the inbox numbers at
 *  /features/shared-inbox, so two pairs share a destination.
 *  connects, not outcome claims we have no data for. */
const STATS: WaStat[] = [
  {
    value: '0%',
    label: 'Reseller markup',
    note: 'Meta bills you at Meta’s rates',
    detail:
      'You connect on your own WhatsApp Business Account, so Meta invoices you directly at its published rates. Instant never sits in the middle of a conversation and never takes a cut of one — you pay a flat plan fee and nothing per message.',
    href: '/pricing',
  },
  {
    value: '1',
    label: 'Number, unlimited seats',
    note: 'The whole team, same thread',
    detail:
      'One business number, and as many people answering it as you need. Everyone works the same conversation and sees the same history, so a customer never has to repeat themselves to the second person who picks up.',
    href: '/features/shared-inbox',
  },
  {
    value: '3',
    label: 'Channels, one inbox',
    note: 'WhatsApp, Instagram, Messenger',
    detail:
      'All three land in the same inbox, against the same contact. Someone who asks on Instagram and follows up on WhatsApp is one conversation with one history, not three strangers in three tabs.',
    href: '/features/shared-inbox',
  },
  {
    value: '14',
    label: 'Days free',
    note: 'Every feature, no card',
    detail:
      'The whole product for fourteen days — every channel, every automation, the AI agents included. No card up front, and nothing switches off mid-trial to make a point.',
    href: '/pricing',
  },
];

/**
 * The page's single pure-black band, and the numbers are all of it.
 *
 * It used to be the lower half of a longer band — a "direct to Meta"
 * argument above, these figures below, a hairline between them. That
 * argument is gone, so the hairline went with it (it was the seam
 * between two black sections, and there is only one now) and the
 * padding is symmetrical again rather than bottom-only.
 *
 * As a tab set rather than a four-up grid: each figure is a tab down
 * the left, the detail for the selected one fills the right. The grid
 * gave every number equal weight and room for one line; this gives the
 * reader one at a time and room to say something about it.
 *
 * The tab UI itself lives in stats-tabs.tsx, which is a client
 * component; this file stays a server one.
 */
function StatsBand() {
  return (
    <section className="bg-black px-6 py-20 text-white sm:py-24">
      <div className="mx-auto max-w-[1080px]">
        <WaStatsTabs stats={STATS} />
      </div>
    </section>
  );
}

/* ─── Maya ────────────────────────────────────────────────────────── */

const AGENTS = [
  {
    stat: '24/7',
    statLabel: 'Qualifying and converting',
    title: 'Maya qualifies your leads',
    body: 'She works out who is serious, scores them, and writes the details straight into your CRM — while the enquiry is still warm.',
    cta: 'Meet Maya',
    thread: [
      { side: 'in' as const, text: "Hi — we're comparing tools for a 12-person team." },
      { side: 'out' as const, text: 'Happy to help. What matters most — the shared inbox, campaigns, or automations?' },
    ],
  },
  {
    stat: '6s',
    statLabel: 'Average first reply',
    title: 'Maya answers your customers',
    body: 'She handles the questions that fill an inbox — delivery, returns, sizing, hours — and hands over the moment a person is genuinely needed.',
    cta: 'Train Maya',
    thread: [
      { side: 'in' as const, text: 'Do you deliver on Sundays?' },
      { side: 'out' as const, text: 'Yes — orders placed before 2pm Saturday arrive Sunday.' },
    ],
  },
];

function Maya() {
  return (
    <Section>
      <Heading
        size="md"
        title={
          <>
            10X your performance with{' '}
            {/* The hero's green highlight box, around the assistant's
                handle — the same device, so the two read as one page.
                Not the solid voltage green, which the spec reserves for
                the CTA pill. `whitespace-nowrap` keeps the handle and its
                box on one line when the title wraps. */}
            <span className="rounded-[0.14em] border border-[#1fae55] bg-[#d4f5c6] px-[0.12em] whitespace-nowrap text-(--wa-green)">
              @askMaya
            </span>
          </>
        }
        subtitle="Let Maya take the repetitive work off your team, so the hours they do spend on WhatsApp go into the conversations that build relationships — and revenue."
      />
      <div className="mx-auto mt-14 grid max-w-[1080px] gap-4 md:grid-cols-2">
        {AGENTS.map((a) => (
          <div key={a.title} className="flex flex-col rounded-[25px] bg-white p-7 sm:p-8">
            <p className="flex items-baseline gap-3">
              <span className="text-[48px] leading-none tracking-[-0.02em] text-(--wa-ink)">{a.stat}</span>
              <span className={cn(waType.bodyMd, 'text-(--wa-ink-muted)')}>{a.statLabel}</span>
            </p>
            <div className="mt-6 flex-1 space-y-2.5 rounded-[20px] bg-(--wa-canvas) p-4">
              {a.thread.map((m) => (
                <Bubble key={m.text} side={m.side} text={m.text} />
              ))}
            </div>
            <h3 className="mt-7 text-[24px] leading-[28px] text-(--wa-ink)">{a.title}</h3>
            <p className={cn(waType.bodyMd, 'mt-3 text-pretty text-(--wa-ink-muted)')}>{a.body}</p>
            <div className="mt-6">
              <Magnetic>
                <Link href="/ask-maya" className={hardShadowButton}>
                  {a.cta}
                </Link>
              </Magnetic>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ─── Integrations ────────────────────────────────────────────────── */

// Copy accuracy carried over from lp2/integrations.tsx: there is no
// marketplace app yet, so it is always "through the API", never "native".
const TRIGGERS = [
  'Abandoned cart, back in stock, price drop',
  'Order confirmed, packed, shipped, delivered',
  'Payment failed, refund issued, invoice due',
  'Form drop-off, demo booked, event reminder',
];

function Integrations() {
  return (
    <Section id="integrations">
      <div className="mx-auto grid max-w-[1080px] items-center gap-12 lg:grid-cols-2">
        <div>
          <h2 className={cn(waType.displayMd, 'text-balance')}>Connect the stack you already run</h2>
          <p className={cn(waType.bodyLg, 'mt-6 text-pretty text-(--wa-ink-muted)')}>
            Your CRM, payment portals and eCommerce platforms — Shopify,
            WooCommerce, HubSpot, Zapier — through the Instant REST API and
            outbound webhooks. Then automate the message that should follow:
          </p>
          <ul className="mt-6 space-y-3">
            {TRIGGERS.map((t) => (
              <li key={t} className={cn(waType.bodyMd, 'flex items-start gap-3 text-(--wa-ink)')}>
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-(--wa-mint)">
                  <Check className="size-3.5" strokeWidth={2.5} />
                </span>
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-9">
            <Magnetic>
              <Link href="/docs/api-and-integrations" className={hardShadowButton}>
                View all integrations
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </Link>
            </Magnetic>
          </div>
        </div>
        <div className="overflow-hidden rounded-[25px] bg-white">
          <Image
            src={ORBIT_ART}
            alt="The Instant mark ringed by Shopify, Make, Zoho, Google Sheets, Zapier and a REST API badge"
            width={1000}
            height={1000}
            sizes="(min-width: 1024px) 32rem, 100vw"
            className="h-auto w-full"
          />
        </div>
      </div>
    </Section>
  );
}

/* ─── Showcase ────────────────────────────────────────────────────── */

/**
 * The site's own words, not the customer's. Deliberately NOT a quote:
 * putting invented words next to a real business's logo would publish
 * an endorsement they never gave. When their actual words arrive (in
 * writing), this becomes a quote again — restore the <blockquote> and
 * the Quote watermark in Showcase below, both removed for the same
 * reason.
 */
const SHOWCASE_COPY =
  'Catering enquiries, menus and bookings — all on one WhatsApp number, answered by whoever on the team is free.';

/**
 * A white tile below the integrations: the catering shot on the left,
 * a customer quote centred in the space beside it, their logo in the
 * bottom-right corner.
 *
 * Fixed at 500px so the section holds its place in the scroll, and
 * 1328px wide — the nav's column, wider than the 1080px the sections
 * above and below use, so the tile deliberately overhangs them.
 * `rounded-[25px]` is the same tile radius the blog cards use.
 *
 * The image is portrait (1086x1448), so it is sized by height and lets
 * its width follow, which keeps it whole instead of cropping it. It is
 * greyscaled so it reads as a backdrop for the quote rather than
 * competing with it — and so the logo is the only colour in the tile.
 *
 * White reads as a raised surface here because the page canvas behind
 * it is the spec's warm cream, not white.
 */
function Showcase() {
  return (
    <Section>
      {/* Title left, controls right — the same header shape WaRail uses
          for the features carousel. NOTE: the brief said "power users of
          Gallabox"; Gallabox is a different product, so this says
          Instant. Change it back only if naming them is deliberate. */}
      <div className="mx-auto flex max-w-[1328px] flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[720px]">
          <h2 className={cn(waType.displayMd, 'text-balance')}>
            Hear from the power users of Instant
          </h2>
          <p className={cn(waType.bodyLg, 'mt-5 max-w-[560px] text-pretty text-(--wa-ink-muted)')}>
            Teams running their bookings, enquiries and follow-ups through one
            shared WhatsApp number — and what changed once they did.
          </p>
        </div>

        {/* Inert until there is more than one testimonial to move between:
            `disabled` rather than a click that does nothing. Wire them (or
            move this section onto WaRail) when the second one lands. */}
        <div className="flex shrink-0 gap-3">
          {[
            { label: 'Previous', Icon: ChevronLeft },
            { label: 'Next', Icon: ChevronRight },
          ].map(({ label, Icon }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              disabled
              className="inline-flex size-11 items-center justify-center rounded-full border border-(--wa-ink) text-(--wa-ink) transition-colors hover:bg-(--wa-ink) hover:text-(--wa-canvas) disabled:pointer-events-none disabled:opacity-30"
            >
              <Icon className="size-5" />
            </button>
          ))}
        </div>
      </div>

      {/* `relative` so the logo can hang off the bottom-right corner.
      
          `lp2-hard-shadow` is not a style — it is the opt-out from
          whatsapp.css's blanket `box-shadow: none !important`, which is
          how the design stays flat. Without it the shadow below is
          stripped and nothing renders. */}
      <div className="lp2-hard-shadow relative mx-auto mt-14 flex h-[500px] w-full max-w-[1328px] items-center gap-10 overflow-hidden rounded-[25px] bg-white p-2 shadow-[4px_4px_0_2px_rgba(0,0,0,0.05)]">
        <Image
          src="/images/showcase/rahul-catering-services.png"
          alt="Rahul Catering Services on WhatsApp"
          width={1086}
          height={1448}
          className="h-full w-auto rounded-[16px] object-contain grayscale"
          sizes="(max-width: 640px) 60vw, 320px"
        />

        {/* The line sits in the middle of whatever width is left, not of
            the tile, so it stays centred as the image takes its share.
            `py-16` is symmetrical so the gap above and below matches, and
            keeps the text clear of the logo in the corner. */}
        <div className="relative flex flex-1 items-center justify-center px-6 py-16">
          <p
            className={cn(
              waType.displayMd,
              'max-w-[62ch] leading-[1.3] text-balance text-left text-(--wa-ink)',
            )}
          >
            {SHOWCASE_COPY}
          </p>
        </div>

        <Image
          src="/images/showcase/rahul-catering-logo.png"
          alt="Rahul Catering Services"
          width={1714}
          height={1247}
          className="absolute right-6 bottom-5 h-14 w-auto object-contain sm:right-8 sm:bottom-6 sm:h-16"
          sizes="180px"
        />
      </div>
    </Section>
  );
}

/* ─── Pricing note ────────────────────────────────────────────────── */

/** Entry plan (Starter) — mirrors src/lib/marketing/pricing-data.ts, the
 *  same duplication lp2/pricing-note.tsx carries. Change both together. */
const STARTING_PRICE = '₹499';

function PricingNote() {
  return (
    <Section>
      <div className="mx-auto grid max-w-[1080px] items-end gap-10 border-t border-(--wa-hairline) pt-16 lg:grid-cols-[1fr_auto] lg:gap-20">
        <div>
          <p className={cn(waType.caption, 'tracking-wide text-(--wa-ink-muted) uppercase')}>Pricing</p>
          <h2 className={cn(waType.displayMd, 'mt-4 text-balance')}>One flat fee. Never per message.</h2>
          <p className={cn(waType.bodyLg, 'mt-6 max-w-[620px] text-pretty text-(--wa-ink-muted)')}>
            Most WhatsApp platforms take a cut of every conversation. We don’t —
            your messages are billed by Meta, to you, at Meta’s rates.
          </p>
          <div className="mt-8">
            <Magnetic>
              <Link href="/pricing" className={hardShadowButton}>
                See the plans
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </Link>
            </Magnetic>
          </div>
        </div>
        <div>
          <p className={cn(waType.bodyMd, 'text-(--wa-ink-muted)')}>Starting at</p>
          <p className={cn(waType.displayXl, 'mt-2 tabular-nums')}>{STARTING_PRICE}</p>
          <p className={cn(waType.caption, 'mt-3 tracking-wide text-(--wa-ink-muted) uppercase')}>Per month</p>
        </div>
      </div>
    </Section>
  );
}

/* ─── Recent posts ────────────────────────────────────────────────── */

/** Newest published posts, cached for five minutes — the same window as
 *  /blog. This page renders per request (it reads the design cookie), so
 *  without the cache every landing-page visit would query the database. */
const getRecentPosts = unstable_cache(
  async () => getPublishedPosts(8),
  ['wa-landing-recent-posts'],
  { revalidate: 300 },
);

/** Below this many real posts the rail looks empty, so development tops
 *  it up with SAMPLE_BLOG_CARDS to preview the layout. Production never
 *  does: a visitor only ever sees articles that exist. */
const PREVIEW_MIN_CARDS = 5;

async function RecentPosts() {
  const posts = await getRecentPosts();

  const cards: WaBlogCardItem[] = posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    dateLabel: formatPostDate(p.publishedAt),
  }));

  if (process.env.NODE_ENV !== 'production' && cards.length < PREVIEW_MIN_CARDS) {
    cards.push(...SAMPLE_BLOG_CARDS.slice(0, PREVIEW_MIN_CARDS - cards.length));
  }

  // Nothing published yet: leave the section out rather than show a lone
  // "see every article" card pointing at an empty blog.
  if (cards.length === 0) return null;

  return <WaBlogRail posts={cards} />;
}

/* ─── FAQ ─────────────────────────────────────────────────────────── */

const FAQS = [
  { q: 'Do I need the official WhatsApp Business API?', a: 'Yes — Instant is an official Meta Tech Provider and runs on Meta’s own Cloud API, which is what keeps your number safe from bans and your messages compliant. Connecting takes a few clicks through embedded signup, and we walk you through it.' },
  { q: 'What does “official Meta Tech Provider” actually mean?', a: 'Meta reviews and approves the companies allowed to build on the WhatsApp Business Platform, and Instant is one of them. In practice it means you connect to Meta directly — embedded signup on your own WhatsApp Business Account, direct Cloud API access, and message charges billed to you by Meta at Meta’s published rates, with no reseller sitting in the middle taking a cut.' },
  { q: 'Can my whole team use one WhatsApp number?', a: 'That is exactly what Instant is for. Everyone works from a shared inbox on the same number, with assignments, internal notes and the full conversation history — no more forwarding screenshots.' },
  { q: 'How does the AI agent actually learn my business?', a: 'You upload your own knowledge base — product docs, FAQs, policies. It answers routine questions instantly, writes lead details into contact fields, and hands off to a human whenever it should. Test everything in the playground before it goes anywhere near a customer.' },
  { q: 'What happens when the free trial ends?', a: 'Your 14-day trial includes every feature. When it ends, pick a plan to keep sending — your data, contacts and history stay untouched either way.' },
  { q: 'Can I send bulk broadcasts?', a: 'Yes — build campaigns on Meta-approved templates, target them with tags, lists and segments, and watch delivery and read stats update in real time.' },
  { q: 'Does it connect to my other tools?', a: 'Zapier, Make and n8n via outbound webhooks (message received, contact created, deal stage changed, and more), plus a REST API for creating contacts or sending messages from any system you already run.' },
  { q: 'Can I bring Instagram and Messenger in too?', a: 'Yes — on plans with those channels, Instagram DMs and Messenger threads land in the same shared inbox, so one team covers all three.' },
];

function Faq() {
  return (
    <Section>
      <Heading size="md" title="Everything people ask before signing up" />
      <div className="mx-auto mt-12 max-w-[900px] divide-y divide-(--wa-hairline) border-y border-(--wa-hairline)">
        {FAQS.map((f) => (
          <details key={f.q} className="group">
            <summary className="flex cursor-pointer list-none items-center gap-4 py-5 text-[20px] leading-[26px] text-(--wa-ink) [&::-webkit-details-marker]:hidden">
              <span className="flex-1 text-pretty">{f.q}</span>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-(--wa-hairline) transition-transform duration-200 group-open:rotate-45">
                <Plus className="size-4" />
              </span>
            </summary>
            <p className={cn(waType.bodyLg, 'pr-12 pb-6 text-pretty text-(--wa-ink-muted)')}>{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

/* ─── Closing CTA ─────────────────────────────────────────────────── */

function ClosingCta() {
  return (
    <Section>
      <div className="mx-auto max-w-[900px] text-center">
        {/* "typing" and the dots in the voltage green. The spec reserves
            that green for the primary CTA, so this is a deliberate
            exception — the word is the page's closing image, not a
            control. Dots are aria-hidden: the sentence already says it. */}
        <h2 className={cn(waType.displayXl, 'text-balance')}>
          Your customers are already{' '}
          <span className="text-(--wa-green)">typing</span>
          <span aria-hidden className="wa-typing">
            <span />
            <span />
            <span />
          </span>
        </h2>
        <p className={cn(waType.bodyLg, 'mx-auto mt-7 max-w-[560px] text-pretty text-(--wa-ink-muted)')}>
          Set up in an afternoon, free for 14 days, no card required. Worst case
          you learn what your customers have been asking all along.
        </p>
        {/* gap-5: each button throws a 4px shadow on hover and, now that
            it is magnetic, can lean up to 14px toward the cursor. Only
            the hovered one moves — the field is its own wrapper — so 20px
            is enough to keep the leaning button clear of its neighbour. */}
        <div className="mt-10 flex flex-col items-center justify-center gap-5 sm:flex-row">
          <Magnetic>
            <Link href="/signup" className={hardShadowButton}>
              Start free trial
              <ArrowRight className="size-4" strokeWidth={2.5} />
            </Link>
          </Magnetic>
          <Magnetic>
            <Link href="/login" className={hardShadowButton}>
              Log in
            </Link>
          </Magnetic>
        </div>
      </div>
    </Section>
  );
}
