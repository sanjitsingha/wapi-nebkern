import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Check,
  Plus,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { SiteHeader, SiteFooter } from '@/components/marketing/site-chrome';
import { JourneyTabs, TeamTabs } from '@/components/marketing/landing-tabs';
import { IntegrationShowcase } from '@/components/marketing/integration-showcase';
import {
  ChatBubble,
  CheckItem,
  GradientBars,
  MiniCampaign,
  MiniFlow,
  MiniInbox,
  MiniKanban,
  PhoneFrame,
} from '@/components/marketing/landing-visuals';
import { HeroOrbit } from '@/components/marketing/hero-orbit';

// The public marketing landing page. Unlike the rest of the app (which
// is noindex — it's a private product surface), this page is the front
// door, so we override robots to allow indexing and give it its own
// absolute title (bypassing the "%s — wacrm" template).
export const metadata: Metadata = {
  title: { absolute: 'wacrm — Your customers are circling. Reach every one, on WhatsApp.' },
  description:
    'Price checks, callbacks, catalogue asks — wacrm pulls every WhatsApp conversation into one shared inbox, answers with AI agents, and turns it into a deal. Broadcast campaigns, pipelines, and no-code automations on the official WhatsApp Business API.',
  robots: { index: true, follow: true },
};

// Fully static — nothing on this page reads the database any more
// (pricing is hardcoded copy), so it prerenders once at build time.

const btnPrimary =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover';
const btnGhost =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted';

export default function LandingPage() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <LogoCloud />
        <Journey />
        <AiAgents />
        <Platform />
        <Teams />
        <Integrations />
        <StatsBand />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ─── Hero ────────────────────────────────────────────────────────── */

// The four crosshair ticks that sit where the framed column's side rails
// meet the section's top/bottom edges — the signature "drawn frame" detail.
function CornerTicks() {
  const base = 'text-muted-foreground/30 pointer-events-none absolute z-10 size-4';
  return (
    <>
      <Plus aria-hidden className={`${base} -top-2 -left-2`} />
      <Plus aria-hidden className={`${base} -top-2 -right-2`} />
      <Plus aria-hidden className={`${base} -bottom-2 -left-2`} />
      <Plus aria-hidden className={`${base} -bottom-2 -right-2`} />
    </>
  );
}

function Hero() {
  return (
    <section className="border-border relative overflow-hidden border-b">
      {/* Background grid, masked to fade toward the edges. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage:
            'radial-gradient(ellipse 75% 65% at 50% 0%, black, transparent)',
          WebkitMaskImage:
            'radial-gradient(ellipse 75% 65% at 50% 0%, black, transparent)',
        }}
      />
      {/* Soft brand glow behind the headline. */}
      <div
        aria-hidden
        className="bg-primary/10 pointer-events-none absolute -top-40 left-1/2 -z-10 h-96 w-184 -translate-x-1/2 rounded-full blur-3xl"
      />

      {/* Framed content column — full-bleed section, 1000px rails. */}
      {/* The 1240px orbit is intentionally wider than this column, so it
          bleeds off the sides. `xl:min-h-300` (1200px) is what keeps the
          VERTICAL crop shallow: every chip passes through 12 and 6
          o'clock on each lap, and any height much below the ring's
          would have them disappear for a long stretch of it. */}
      <div className="border-border relative mx-auto flex w-full max-w-350 flex-col justify-center border-x px-6 pt-16 pb-20 sm:pt-20 xl:min-h-300 xl:py-24">
        <CornerTicks />

        {/* Customers circling the copy, just out of reach. */}
        <HeroOrbit />

        <div className="relative mx-auto max-w-lg text-center">
          <Link
            href="/#ai-agents"
            className="border-border bg-card text-muted-foreground hover:text-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          >
            <span className="bg-primary flex h-1.5 w-1.5 rounded-full" />
            Built on the official WhatsApp Business API
          </Link>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl md:leading-[1.05]">
            Your customers are circling.{' '}
            <span className="text-primary">Reach every one.</span>
          </h1>

          <p className="text-muted-foreground mx-auto mt-6 max-w-md text-base text-pretty sm:text-lg">
            Every WhatsApp question caught in one shared inbox, answered by AI,
            and turned into a deal you can close.
          </p>

          <div className="mt-9 flex justify-center">
            <Link
              href="/signup"
              className={`${btnPrimary} h-12 w-full px-6 sm:w-auto`}
            >
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Logo cloud ──────────────────────────────────────────────────── */

function LogoCloud() {
  return (
    <section className="mx-auto max-w-350 px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-muted-foreground text-center text-xs font-medium tracking-wide uppercase">
        Trusted by teams that run their business on WhatsApp
      </p>
      <div className="mt-8 grid grid-cols-2 items-center gap-x-8 gap-y-6 sm:grid-cols-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <LogoPlaceholder key={i} />
        ))}
      </div>
    </section>
  );
}

function LogoPlaceholder() {
  return (
    <div className="border-border/70 text-muted-foreground/60 flex h-10 items-center justify-center gap-2 rounded-lg border border-dashed">
      <span className="bg-muted-foreground/30 h-4 w-4 rounded" />
      <span className="bg-muted-foreground/25 h-2.5 w-14 rounded-full" />
    </div>
  );
}

/* ─── Customer journey (tabbed) ───────────────────────────────────── */

function Journey() {
  return (
    <section id="journey" className="border-border bg-card/40 scroll-mt-20 border-y">
      {/*
        No fixed height here on purpose. The journey is a scroll story:
        five stacked panels give the section its length, and the strip
        pins itself while they pass. A `min-h` + flex column would fight
        that by trying to fit everything on one screen — and any
        `overflow` clamp on an ancestor silently kills `position: sticky`.
      */}
      <div className="mx-auto max-w-350 px-4 py-24 sm:px-6 sm:py-28">
        {/* Passed IN rather than rendered above, because the heading has
            to live inside the sticky block and pin along with the tab
            strip — not scroll away above it. */}
        <JourneyTabs
          heading={
            <SectionHeadingSplit
              title="Every stage, from first hello to repeat order. Automated."
              subtitle="wacrm covers the whole funnel on WhatsApp — capture leads, qualify them with AI, nurture with campaigns, convert on pipelines, and retain with automations."
            />
          }
        />
      </div>
    </section>
  );
}

/* ─── AI agents spotlight ─────────────────────────────────────────── */

function AiAgents() {
  return (
    <section id="ai-agents" className="mx-auto max-w-350 scroll-mt-20 px-4 py-24 sm:px-6 sm:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-primary flex items-center gap-1.5 text-sm font-semibold">
            <Bot className="h-4 w-4" /> AI Agents
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            An AI agent trained on your business, replying in seconds
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed">
            Feed it your catalog, policies, and FAQs — your AI agent answers
            instantly and around the clock, captures lead details into your
            CRM, and hands the conversation to a human the moment it should.
          </p>
          <ul className="mt-6 space-y-3">
            <CheckItem>
              Train it on your own knowledge base — docs, FAQs, and policies
            </CheckItem>
            <CheckItem>
              Test every change safely in the built-in playground
            </CheckItem>
            <CheckItem>
              Automatic handoff to your team when a human touch is needed
            </CheckItem>
            <CheckItem>
              Every AI reply logged in the shared inbox, never a black box
            </CheckItem>
          </ul>
          <Link href="/signup" className={`${btnPrimary} mt-8`}>
            Try the AI agent
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="relative flex justify-center">
          <div
            aria-hidden
            className="bg-primary/10 pointer-events-none absolute inset-x-8 top-6 bottom-0 -z-10 rounded-[2.5rem] blur-2xl"
          />
          <PhoneFrame title="Nova Store" subtitle="AI agent · online">
            <ChatBubble side="in" time="22:47">
              Are you open on Sundays?
            </ChatBubble>
            <ChatBubble side="out" time="22:47" ai>
              We&apos;re open 10am–6pm on Sundays! Orders placed tonight ship
              Monday morning. 🚚
            </ChatBubble>
            <ChatBubble side="in" time="22:48">
              Do you have EMI options?
            </ChatBubble>
            <ChatBubble side="out" time="22:48" ai>
              Yes — 3, 6, and 12-month EMI on orders above ₹10,000. Want me to
              share the details for your cart?
            </ChatBubble>
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}

/* ─── Platform features (bento grid of mini product UIs) ──────────── */

// Laid out as a bento: a six-column grid where `wide` cards take four
// columns and the rest take two, giving a 4–2 / 2–4 rhythm rather than
// four identical cards. Order matters — it's what makes the two rows
// mirror each other, so keep a wide card at each end.
const PLATFORM = [
  {
    title: 'Shared team inbox',
    description:
      'Every WhatsApp and Instagram conversation in one place — assign chats, leave internal notes, and reply as a team.',
    visual: <MiniInbox />,
    wide: true,
  },
  {
    title: 'Broadcast campaigns',
    description:
      'Reach thousands with approved templates and watch delivery, read, and reply rates update live.',
    visual: <MiniCampaign />,
    wide: false,
  },
  {
    title: 'Pipelines & CRM',
    description:
      'Custom fields, tags, and drag-and-drop deal stages — a full CRM built around your WhatsApp conversations.',
    visual: <MiniKanban />,
    wide: false,
  },
  {
    title: 'Flows & automations',
    description:
      'No-code triggers, conditions, and actions that answer, route, and follow up while you sleep.',
    visual: <MiniFlow />,
    wide: true,
  },
] as const;

function Platform() {
  return (
    <section id="features" className="border-border bg-card/40 scroll-mt-20 border-y">
      <div className="mx-auto max-w-350 px-4 py-24 sm:px-6 sm:py-28">
        <SectionHeading
          eyebrow="The platform"
          title="The platform behind the conversations"
          subtitle="Four tools that usually live in four different apps — working as one, on the official WhatsApp Business API."
        />

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
          {PLATFORM.map((f) => (
            <div
              key={f.title}
              className={cn(
                // No padding on the card itself: each card is split into
                // a padded content half and a full-bleed graphics half,
                // and the graphics tint has to reach the card's edges.
                // `overflow-hidden` is what makes it respect the corner
                // radius instead of squaring off the corners.
                'border-border bg-card overflow-hidden rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-md',
                // Wide cards go full-bleed on the two-column tablet grid
                // too — a 4-col card squeezed into half a tablet row
                // leaves its side-by-side split too narrow to read.
                f.wide ? 'sm:col-span-2 lg:col-span-4' : 'lg:col-span-2',
              )}
            >
              {f.wide ? (
                // Wide: content and graphics side by side. No gap — the
                // two halves meet, so the tint reads as a panel of the
                // card rather than a floating swatch inside it.
                <div className="grid h-full sm:grid-cols-2">
                  <div className="flex flex-col justify-center p-6 sm:p-7">
                    <h3 className="text-2xl font-normal">{f.title}</h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                      {f.description}
                    </p>
                  </div>
                  {/* grid (not flex) so the single child stretches to
                      full width on its own, while items-center keeps it
                      vertically centred when the text column is taller.
                      Padding insets the visual; the tint stays full-bleed
                      because it's on this container, not the child. */}
                  <div className="grid items-center bg-[#F6FFEC] p-5 sm:p-6">
                    {f.visual}
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col">
                  <div className="grid flex-1 items-center bg-[#F6FFEC] p-5 sm:p-6">
                    {f.visual}
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-normal">{f.title}</h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                      {f.description}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Use cases by team (tabbed) ──────────────────────────────────── */

function Teams() {
  return (
    <section
      id="teams"
      className="mx-auto max-w-350 scroll-mt-20 px-4 py-24 sm:px-6 sm:py-28 lg:flex lg:min-h-[110vh] lg:flex-col"
    >
      <SectionHeadingSplit
        eyebrow="Built for your team"
        title="Sales, marketing, and support — one inbox, zero silos"
        subtitle="Whoever owns the conversation, wacrm gives them the tools to move it forward."
      />
      <TeamTabs />
    </section>
  );
}

/* ─── Integrations ────────────────────────────────────────────────── */

function Integrations() {
  return (
    <section id="integrations" className="border-border bg-card/40 scroll-mt-20 border-y">
      {/* Interactive: hovering a tool on the right swaps the left copy
          over to that tool's detail, so the column earns its space
          instead of holding one static paragraph. Lives in a client
          component because that swap is pointer-driven. */}
      <IntegrationShowcase />
    </section>
  );
}

/* ─── Stats band ──────────────────────────────────────────────────── */

const STATS = [
  { value: '1 inbox', label: 'For your whole team' },
  { value: 'Unlimited', label: 'Contacts & tags' },
  { value: '24/7', label: 'AI agent coverage' },
  { value: '100%', label: 'Yours to host' },
] as const;

function StatsBand() {
  return (
    <section className="border-border bg-card/50 border-y">
      {/* No flanking GradientBars here any more — the stats grid spans
          the full column on its own. */}
      <div className="mx-auto max-w-350 px-4 py-14 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                {s.value}
              </p>
              <p className="text-muted-foreground mt-1.5 text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing ─────────────────────────────────────────────────────── */

/**
 * Static on purpose — this table is marketing copy, not a live read of
 * `billing_plans`. It used to query the table on every render; that
 * coupled the front page to the database and to whatever an operator
 * had typed into the admin panel (where `features` is empty on every
 * plan today, so the cards rendered a bare price and nothing else).
 *
 * The numbers below were taken from the live plans, so they are real:
 * seats, contacts and storage match the `limits` actually enforced, and
 * the capability lists match the `allow_*` flags per tier. If pricing or
 * limits change in the admin, update this block to match — nothing
 * syncs it automatically any more.
 *
 * `surface`/`line`/`accent` tint each card. The middle one is the same
 * mint used elsewhere on this page, so the table sits inside the
 * existing palette rather than importing a new one.
 */
const PRICING = [
  {
    name: 'Try',
    tagline: 'Kick the tyres on a real WhatsApp number, with your own contacts.',
    price: '₹100',
    per: 'month',
    meta: '2 seats · 60 contacts',
    tint: { surface: '#F1F7FF', line: '#CFE3FB', accent: '#2F6FED' },
    featured: false,
    featuresTitle: 'Key features',
    features: [
      'Shared team inbox on the official API',
      'Contacts, tags and custom fields',
      'Message templates and broadcasts',
      'Sales pipelines and deal stages',
      'AI agent with your own knowledge base',
    ],
    usage: ['2 team members', '60 contacts', '10 MB media storage'],
  },
  {
    name: 'Pro',
    tagline: 'For teams running acquisition and support on WhatsApp daily.',
    price: '₹999',
    per: 'month',
    meta: '10 seats · 25,000 contacts',
    tint: { surface: '#F6FFEC', line: '#CDE9A8', accent: '#4D8A16' },
    featured: true,
    featuresTitle: 'Everything in Try, plus',
    features: [
      'No-code automations and triggers',
      'Flows — visual chatbot builder',
      'WhatsApp calling',
      'Instagram and Messenger channels',
      'REST API, API keys and outbound webhooks',
    ],
    usage: ['10 team members', '25,000 contacts', '5 GB media storage'],
  },
  {
    name: 'Business',
    tagline: 'Unlimited seats and contacts, for when WhatsApp is the business.',
    price: '₹2,499',
    per: 'month',
    meta: 'Unlimited seats · unlimited contacts',
    tint: { surface: '#FBF3FF', line: '#E6CFF7', accent: '#8B44C8' },
    featured: false,
    featuresTitle: 'Everything in Pro, plus',
    features: [
      'Unlimited team members',
      'Unlimited contacts',
      'Roles and granular permissions',
      'Priority support with faster response times',
      'Self-host it on your own infrastructure',
    ],
    usage: [
      'Unlimited team members',
      'Unlimited contacts',
      '20 GB media storage',
    ],
  },
] as const;

function Pricing() {
  return (
    <section id="pricing" className="border-border bg-card/40 scroll-mt-20 border-y">
      <div className="mx-auto max-w-350 px-4 py-24 sm:px-6 sm:py-28">
        <SectionHeading
          eyebrow="Simple pricing"
          title="Pick a plan that grows with you"
          subtitle="Start free, upgrade when you're ready. Every plan runs on the official WhatsApp Business API."
        />

        {/* `items-start` so a taller card can't stretch its neighbours
            into matching whitespace — each card ends where its own
            content does. */}
        <div className="mx-auto mt-16 grid max-w-4xl items-start gap-6 lg:max-w-none lg:grid-cols-3">
          {PRICING.map((plan) => {
            const cta = (
              <Link
                href="/signup"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-sm transition-[filter] hover:brightness-110"
                style={{ backgroundColor: plan.tint.accent }}
              >
                Select plan
                <ArrowRight className="h-4 w-4" />
              </Link>
            );

            return (
              <div
                key={plan.name}
                className="relative flex flex-col rounded-3xl border p-6 sm:p-7"
                style={{
                  backgroundColor: plan.tint.surface,
                  borderColor: plan.tint.line,
                }}
              >
                {plan.featured && (
                  <span className="absolute -top-3 right-5 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-amber-950 shadow-sm">
                    Best value
                  </span>
                )}

                <h3 className="text-lg font-bold tracking-tight">{plan.name}</h3>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  {plan.tagline}
                </p>

                <p className="mt-5 flex items-baseline gap-1.5">
                  <span
                    className="text-4xl font-bold tracking-tight"
                    style={{ color: plan.tint.accent }}
                  >
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground text-sm font-medium">
                    /{plan.per}
                  </span>
                </p>
                <p className="text-muted-foreground mt-2 text-xs">{plan.meta}</p>

                <div className="mt-5">{cta}</div>

                {/* ── What you get ── */}
                <div
                  className="mt-7 border-t pt-5"
                  style={{ borderColor: plan.tint.line }}
                >
                  <p className="text-xs font-bold tracking-wide uppercase">
                    {plan.featuresTitle}
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0"
                          style={{ color: plan.tint.accent }}
                        />
                        <span className="text-sm">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* ── Usage ── */}
                <div
                  className="mt-6 border-t pt-5"
                  style={{ borderColor: plan.tint.line }}
                >
                  <p className="text-xs font-bold tracking-wide uppercase">
                    Usage
                  </p>
                  <ul className="text-muted-foreground mt-3.5 space-y-1.5 text-xs">
                    {plan.usage.map((row) => (
                      <li key={row} className="flex items-start gap-2">
                        <span
                          aria-hidden
                          className="mt-1.5 size-1 shrink-0 rounded-full"
                          style={{ backgroundColor: plan.tint.accent }}
                        />
                        {row}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Repeated CTA — these cards run long, and by the time
                    you've read to the bottom the first button is off
                    screen. Same reason the reference has one at each
                    end. */}
                <div className="mt-7">{cta}</div>
              </div>
            );
          })}
        </div>

        <p className="text-muted-foreground mt-8 text-center text-xs">
          Every account starts with a free 14-day trial — no credit card
          required.
        </p>
      </div>
    </section>
  );
}

/* ─── FAQ ─────────────────────────────────────────────────────────── */

const FAQS = [
  {
    q: 'Do I need the official WhatsApp Business API?',
    a: 'Yes — wacrm runs on the official Cloud API from Meta, which keeps your number safe and compliant. Connecting takes a few clicks with embedded signup; we walk you through it.',
  },
  {
    q: 'Can my whole team use one WhatsApp number?',
    a: 'That is exactly what wacrm is for. Everyone works from a shared inbox on the same number, with assignments, internal notes, and full conversation history.',
  },
  {
    q: 'How does the AI agent work?',
    a: 'You train it on your own knowledge base — product docs, FAQs, policies. It replies to routine questions instantly, captures lead details into contact fields, and hands off to a human whenever needed. You can test everything in the playground before going live.',
  },
  {
    q: 'What happens after the free trial?',
    a: 'Your 14-day trial includes every feature. When it ends, pick a plan to keep sending — your data, contacts, and history stay untouched either way.',
  },
  {
    q: 'Can I send bulk broadcast messages?',
    a: 'Yes — build campaigns on Meta-approved templates, target them with tags, lists, and segments, and watch delivery and read stats in real time.',
  },
  {
    q: 'Does wacrm integrate with my other tools?',
    a: 'Yes — connect Zapier, Make, or n8n using outbound webhooks (message received, contact created, deal stage changed, and more) and use the REST API to create contacts or send messages from any system.',
  },
  {
    q: 'Can I connect Instagram too?',
    a: 'Yes — plans with the Instagram channel bring your Instagram DMs into the same shared inbox, so one team handles both.',
  },
] as const;

function Faq() {
  return (
    <section id="faq" className="scroll-mt-20">
      <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6 sm:py-28">
        <SectionHeading
          eyebrow="FAQ"
          title="Frequently asked questions"
          subtitle="Everything you need to know before getting started."
        />

        <div className="mt-12 space-y-3">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group border-border bg-card rounded-xl border px-5 py-4"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Final CTA ───────────────────────────────────────────────────── */

function FinalCta() {
  return (
    <section className="border-border bg-card/40 border-t">
      <div className="mx-auto flex max-w-350 items-end justify-between gap-8 px-4 py-24 sm:px-6 sm:py-32">
        <GradientBars className="hidden shrink-0 md:flex" />
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Move beyond messaging tools.{' '}
            <span className="text-primary">Turn conversations into revenue.</span>
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-base">
            Join teams using wacrm to capture, qualify, and convert on
            WhatsApp. Get started in minutes — no credit card required.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className={`${btnPrimary} h-12 w-full px-6 sm:w-auto`}
            >
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className={`${btnGhost} border-border h-12 w-full border px-6 sm:w-auto`}
            >
              Log in
            </Link>
          </div>
        </div>
        <GradientBars mirrored className="hidden shrink-0 md:flex" />
      </div>
    </section>
  );
}

/* ─── Shared bits ─────────────────────────────────────────────────── */

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-primary text-sm font-semibold">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      <p className="text-muted-foreground mt-4 text-base leading-relaxed text-pretty">
        {subtitle}
      </p>
    </div>
  );
}

/**
 * Heading for the full-width tabbed sections: title left, supporting
 * copy right. The centred variant above pulls the eye to the middle,
 * which fights a panel whose content starts hard against the left rail
 * — this one starts the reading line where the panel does.
 *
 * Baseline-aligned at lg (`items-end`) so the paragraph sits on the
 * headline's last line rather than floating beside its cap height.
 */
function SectionHeadingSplit({
  eyebrow,
  title,
  subtitle,
}: {
  /** Optional: the journey heading sits inside a pinned block, where an
   *  eyebrow is one more line of permanently-occupied screen. */
  eyebrow?: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-16">
      <div>
        {/* Spacing hangs off the eyebrow, not the h2 — so dropping the
            eyebrow doesn't leave an orphaned gap above the title. */}
        {eyebrow && (
          <p className="text-primary mb-3 text-sm font-semibold">{eyebrow}</p>
        )}
        <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {title}
        </h2>
      </div>
      <p className="text-muted-foreground text-base leading-relaxed text-pretty lg:pb-1.5">
        {subtitle}
      </p>
    </div>
  );
}
