import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Check,
  Code2,
  Plus,
  Puzzle,
  Quote,
  Workflow,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { publicDb } from '@/lib/blog';
import { formatMoney } from '@/lib/billing/plans';
import { SiteHeader, SiteFooter } from '@/components/marketing/site-chrome';
import { JourneyTabs, TeamTabs } from '@/components/marketing/landing-tabs';
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

// Pricing is read live from billing_plans — refresh every 5 minutes.
export const revalidate = 300;

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
        <HowItWorks />
        <StatsBand />
        <Testimonials />
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
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
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
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-28">
        <SectionHeading
          eyebrow="The full customer journey"
          title="Every stage, from first hello to repeat order. Automated."
          subtitle="wacrm covers the whole funnel on WhatsApp — capture leads, qualify them with AI, nurture with campaigns, convert on pipelines, and retain with automations."
        />
        <JourneyTabs />
      </div>
    </section>
  );
}

/* ─── AI agents spotlight ─────────────────────────────────────────── */

function AiAgents() {
  return (
    <section id="ai-agents" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-28">
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

/* ─── Platform features (4 cards with mini product UIs) ───────────── */

const PLATFORM = [
  {
    title: 'Shared team inbox',
    description:
      'Every WhatsApp and Instagram conversation in one place — assign chats, leave internal notes, and reply as a team.',
    visual: <MiniInbox />,
  },
  {
    title: 'Broadcast campaigns',
    description:
      'Reach thousands with approved templates and watch delivery, read, and reply rates update live.',
    visual: <MiniCampaign />,
  },
  {
    title: 'Pipelines & CRM',
    description:
      'Custom fields, tags, and drag-and-drop deal stages — a full CRM built around your WhatsApp conversations.',
    visual: <MiniKanban />,
  },
  {
    title: 'Flows & automations',
    description:
      'No-code triggers, conditions, and actions that answer, route, and follow up while you sleep.',
    visual: <MiniFlow />,
  },
] as const;

function Platform() {
  return (
    <section id="features" className="border-border bg-card/40 scroll-mt-20 border-y">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-28">
        <SectionHeading
          eyebrow="The platform"
          title="The platform behind the conversations"
          subtitle="Four tools that usually live in four different apps — working as one, on the official WhatsApp Business API."
        />

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORM.map((f) => (
            <div
              key={f.title}
              className="border-border bg-card flex flex-col gap-5 rounded-2xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="bg-card-2 border-border/60 rounded-xl border p-3">
                {f.visual}
              </div>
              <div>
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {f.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
          {[
            'Message templates',
            'Contact segments',
            'Media library',
            'Quick replies',
            'Analytics dashboard',
            'Multi-agent seats',
            'Roles & permissions',
            'Support tickets',
          ].map((t) => (
            <span
              key={t}
              className="border-border text-muted-foreground rounded-full border bg-card px-3.5 py-1.5 text-xs font-medium"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Use cases by team (tabbed) ──────────────────────────────────── */

function Teams() {
  return (
    <section id="teams" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-28">
      <SectionHeading
        eyebrow="Built for your team"
        title="Sales, marketing, and support — one inbox, zero silos"
        subtitle="Whoever owns the conversation, wacrm gives them the tools to move it forward."
      />
      <TeamTabs />
    </section>
  );
}

/* ─── Integrations ────────────────────────────────────────────────── */

const INTEGRATIONS = [
  {
    name: 'Zapier',
    blurb: 'Connect 6,000+ apps with triggers and actions',
  },
  {
    name: 'Make',
    blurb: 'Visual scenarios powered by our webhooks',
  },
  {
    name: 'n8n',
    blurb: 'Self-hosted automation for self-hosted CRM',
  },
  {
    name: 'Webhooks',
    blurb: 'message.received, contact.created & more',
  },
  {
    name: 'REST API',
    blurb: 'Create contacts and send messages via API key',
  },
] as const;

function Integrations() {
  return (
    <section id="integrations" className="border-border bg-card/40 scroll-mt-20 border-y">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-28">
        <SectionHeading
          eyebrow="Integrations"
          title="Works with the tools you already use"
          subtitle="Outbound webhooks fire on every important event, and the REST API lets any system create contacts or send messages — no rebuild needed."
        />

        <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:max-w-none">
          {INTEGRATIONS.map((i) => (
            <div
              key={i.name}
              className="border-border bg-card rounded-2xl border p-5 text-center transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="bg-primary-soft text-primary mx-auto flex h-11 w-11 items-center justify-center rounded-xl">
                {i.name === 'REST API' ? (
                  <Code2 className="h-5 w-5" />
                ) : i.name === 'Webhooks' ? (
                  <Workflow className="h-5 w-5" />
                ) : (
                  <Puzzle className="h-5 w-5" />
                )}
              </div>
              <p className="mt-4 text-sm font-semibold">{i.name}</p>
              <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                {i.blurb}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How it works ────────────────────────────────────────────────── */

const STEPS = [
  {
    title: 'Connect',
    description:
      'Link your WhatsApp Business number in a few clicks with embedded signup on the official API.',
  },
  {
    title: 'Import',
    description:
      'Bring contacts in by CSV or let them flow in as customers message you — tagged and organized.',
  },
  {
    title: 'Automate',
    description:
      'Turn on your AI agent, build flows, and set follow-ups so routine work runs itself.',
  },
  {
    title: 'Grow',
    description:
      'Launch campaigns, track deals through your pipeline, and watch it all on the dashboard.',
  },
] as const;

function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-28">
      <SectionHeading
        eyebrow="Easy to set up"
        title="Live in four simple steps"
        subtitle="No lengthy onboarding. Connect your number and start talking to customers today."
      />

      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            className="border-border bg-card relative rounded-2xl border p-7"
          >
            <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold">
              {i + 1}
            </div>
            <h3 className="mt-5 text-base font-semibold">{step.title}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {step.description}
            </p>
          </div>
        ))}
      </div>
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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-14 sm:px-6">
        <GradientBars className="hidden shrink-0 lg:flex" />
        <div className="grid flex-1 grid-cols-2 gap-8 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                {s.value}
              </p>
              <p className="text-muted-foreground mt-1.5 text-sm">{s.label}</p>
            </div>
          ))}
        </div>
        <GradientBars mirrored className="hidden shrink-0 lg:flex" />
      </div>
    </section>
  );
}

/* ─── Testimonials ────────────────────────────────────────────────── */

const TESTIMONIALS = [
  {
    quote:
      'We run every customer conversation, broadcast, and follow-up through wacrm now. Our whole team finally works from the same inbox.',
    name: 'Bettie Porter',
    role: 'Senior Marketing Manager',
    initials: 'BP',
    gradient: 'from-emerald-400 to-emerald-600',
    metric: '3×',
    metricLabel: 'more replies than email campaigns',
  },
  {
    quote:
      'Response times dropped from hours to minutes. Assigning chats and leaving internal notes changed how our support team works.',
    name: 'Marco Diaz',
    role: 'Head of Customer Support',
    initials: 'MD',
    gradient: 'from-sky-400 to-blue-600',
    metric: '−80%',
    metricLabel: 'first-response time',
  },
  {
    quote:
      'The broadcast campaigns pay for the tool by themselves. We see delivery and read rates live, and follow-ups run on autopilot.',
    name: 'Aisha Khan',
    role: 'E-commerce Founder',
    initials: 'AK',
    gradient: 'from-violet-400 to-indigo-600',
    metric: '74%',
    metricLabel: 'average campaign read rate',
  },
] as const;

function Testimonials() {
  return (
    <section id="testimonial" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-28">
      <SectionHeading
        eyebrow="Loved by teams"
        title="See how teams win with wacrm"
        subtitle="Teams that moved their WhatsApp to wacrm stopped losing conversations — and started closing more of them."
      />

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.name}
            className="border-border bg-card flex flex-col rounded-2xl border p-7"
          >
            <Quote className="text-primary/40 h-6 w-6" />
            <blockquote className="text-foreground mt-4 flex-1 text-sm leading-relaxed">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <div className="border-border/70 mt-6 border-t pt-5">
              <p className="text-primary text-2xl font-bold tracking-tight">
                {t.metric}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">{t.metricLabel}</p>
            </div>
            <figcaption className="mt-5 flex items-center gap-3">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br ${t.gradient} text-xs font-semibold text-white`}
              >
                {t.initials}
              </span>
              <div>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-muted-foreground text-xs">{t.role}</p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ─── Pricing (live from billing_plans) ───────────────────────────── */

interface PricingPlanRow {
  key: string;
  name: string;
  tagline: string | null;
  amount: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: unknown;
  is_featured: boolean;
}

async function Pricing() {
  const { data } = await publicDb()
    .from('billing_plans')
    .select('key, name, tagline, amount, currency, interval, features, is_featured')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const plans = (data ?? []) as PricingPlanRow[];
  if (plans.length === 0) return null;

  return (
    <section id="pricing" className="border-border bg-card/40 scroll-mt-20 border-y">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-28">
        <SectionHeading
          eyebrow="Simple pricing"
          title="Pick a plan that grows with you"
          subtitle="Start free, upgrade when you're ready. Every plan runs on the official WhatsApp Business API."
        />

        <div className="mx-auto mt-16 grid max-w-4xl gap-6 lg:max-w-none lg:grid-cols-3">
          {plans.map((plan) => {
            const features = Array.isArray(plan.features)
              ? (plan.features.filter((f) => typeof f === 'string') as string[])
              : [];
            return (
              <div
                key={plan.key}
                className={cn(
                  'border-border bg-card relative flex flex-col rounded-2xl border p-7',
                  plan.is_featured &&
                    'border-primary/40 shadow-lg ring-1 ring-primary/20',
                )}
              >
                {plan.is_featured && (
                  <span className="bg-primary text-primary-foreground absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[11px] font-semibold">
                    Most popular
                  </span>
                )}
                <h3 className="text-base font-semibold">{plan.name}</h3>
                {plan.tagline && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    {plan.tagline}
                  </p>
                )}
                <p className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">
                    {formatMoney(plan.amount, plan.currency)}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    /{plan.interval === 'yearly' ? 'yr' : 'mo'}
                  </span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                      <span className="text-foreground text-sm">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={cn(
                    'mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors',
                    plan.is_featured
                      ? 'bg-primary text-primary-foreground hover:bg-primary-hover'
                      : 'border-border text-foreground hover:bg-muted border',
                  )}
                >
                  Start free trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
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
      <div className="mx-auto flex max-w-6xl items-end justify-between gap-8 px-4 py-24 sm:px-6 sm:py-32">
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
