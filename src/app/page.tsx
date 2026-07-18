import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Inbox,
  Send,
  Users,
  Zap,
  FileText,
  BarChart3,
  Check,
  ArrowRight,
  Quote,
  Image as ImageIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { publicDb } from '@/lib/blog';
import { formatMoney } from '@/lib/billing/plans';
import { SiteHeader, SiteFooter } from '@/components/marketing/site-chrome';

// The public marketing landing page. Unlike the rest of the app (which
// is noindex — it's a private product surface), this page is the front
// door, so we override robots to allow indexing and give it its own
// absolute title (bypassing the "%s — wacrm" template).
export const metadata: Metadata = {
  title: { absolute: 'wacrm — The WhatsApp CRM for your whole team' },
  description:
    'Run every customer conversation, broadcast campaign, and follow-up from one shared inbox — on the official WhatsApp Business API. Self-hostable and easy to set up.',
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
        <TrustStrip />
        <Features />
        <Spotlights />
        <HowItWorks />
        <Pricing />
        <Testimonials />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ─── Hero ────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background grid, masked to fade toward the edges. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage:
            'radial-gradient(ellipse 75% 60% at 50% 0%, black, transparent)',
          WebkitMaskImage:
            'radial-gradient(ellipse 75% 60% at 50% 0%, black, transparent)',
        }}
      />
      {/* Soft brand glow behind the headline. */}
      <div
        aria-hidden
        className="bg-primary/10 pointer-events-none absolute -top-40 left-1/2 -z-10 h-96 w-184 -translate-x-1/2 rounded-full blur-3xl"
      />

      <div className="mx-auto max-w-6xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="border-border bg-card text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
            <span className="bg-primary flex h-1.5 w-1.5 rounded-full" />
            Built on the official WhatsApp Business API
          </span>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
            Increase orders, secure more bookings, and delight every customer{' '}
            <span className="text-primary">effortlessly</span>
          </h1>

          <p className="text-muted-foreground mx-auto mt-6 max-w-xl text-base text-pretty sm:text-lg">
            wacrm brings your contacts, broadcast campaigns, and every WhatsApp
            conversation into one shared inbox — so your whole team can sell and
            support without switching apps.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className={`${btnPrimary} h-12 w-full px-6 sm:w-auto`}
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className={`${btnGhost} border-border h-12 w-full border px-6 sm:w-auto`}
            >
              Log in
            </Link>
          </div>

          <p className="text-muted-foreground mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <Check className="text-primary h-3.5 w-3.5" /> No credit card
              required
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="text-primary h-3.5 w-3.5" /> Self-hostable
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="text-primary h-3.5 w-3.5" /> Set up in minutes
            </span>
          </p>
        </div>

        {/* Hero product shot. Swap the placeholder for a real screenshot. */}
        <div className="relative mx-auto mt-16 max-w-5xl sm:mt-20">
          <div
            aria-hidden
            className="bg-primary/15 pointer-events-none absolute -inset-x-8 -top-8 bottom-0 -z-10 rounded-[2rem] blur-2xl"
          />
          <BrowserFrame
            label="wacrm · Shared inbox"
            imageLabel="Dashboard screenshot"
            aspect="aspect-16/9"
          />
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

/* ─── Trust strip ─────────────────────────────────────────────────── */

function TrustStrip() {
  return (
    <section className="border-border bg-card/50 border-y">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
              {s.value}
            </p>
            <p className="text-muted-foreground mt-1.5 text-sm">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Features ────────────────────────────────────────────────────── */

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
      <SectionHeading
        eyebrow="Everything in one place"
        title="One platform for every customer conversation"
        subtitle="From the first message to the closed deal — wacrm gives your team the tools to sell and support over WhatsApp, without switching apps."
      />

      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="group border-border bg-card rounded-2xl border p-7 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="bg-primary-soft text-primary flex h-11 w-11 items-center justify-center rounded-xl">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-base font-semibold">{title}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Spotlights ──────────────────────────────────────────────────── */

function Spotlights() {
  return (
    <section className="border-border bg-card/40 border-y">
      <div className="mx-auto max-w-6xl space-y-24 px-4 py-24 sm:px-6 sm:space-y-32 sm:py-32">
        {SPOTLIGHTS.map((s) => (
          <Spotlight key={s.title} {...s} />
        ))}
      </div>
    </section>
  );
}

function Spotlight({
  eyebrow,
  title,
  body,
  points,
  frameLabel,
  imageLabel,
  reverse,
}: (typeof SPOTLIGHTS)[number]) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <div className={cn(reverse && 'lg:order-2')}>
        <p className="text-primary text-sm font-semibold">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {title}
        </h2>
        <p className="text-muted-foreground mt-4 text-base leading-relaxed">
          {body}
        </p>
        <ul className="mt-6 space-y-3">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-3">
              <span className="bg-primary-soft text-primary mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                <Check className="h-3 w-3" />
              </span>
              <span className="text-foreground text-sm">{point}</span>
            </li>
          ))}
        </ul>
        <Link href="/signup" className={`${btnPrimary} mt-8`}>
          Start free
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className={cn('relative', reverse && 'lg:order-1')}>
        <div
          aria-hidden
          className="bg-primary/10 pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] blur-2xl"
        />
        <BrowserFrame label={frameLabel} imageLabel={imageLabel} aspect="aspect-4/3" />
      </div>
    </div>
  );
}

/* ─── How it works ────────────────────────────────────────────────── */

function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
      <SectionHeading
        eyebrow="Up and running fast"
        title="Live in three simple steps"
        subtitle="No lengthy onboarding. Connect your number and start talking to customers today."
      />

      <div className="mt-16 grid gap-6 md:grid-cols-3">
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
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
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

/* ─── Testimonials ────────────────────────────────────────────────── */

function Testimonials() {
  return (
    <section id="testimonial" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
      <SectionHeading
        eyebrow="Loved by teams"
        title="Don't take our word for it"
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
            <figcaption className="mt-6 flex items-center gap-3">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${t.gradient} text-xs font-semibold text-white`}
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

/* ─── FAQ ─────────────────────────────────────────────────────────── */

function Faq() {
  return (
    <section className="border-border bg-card/40 border-y">
      <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6 sm:py-32">
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
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-emerald-950 via-emerald-900 to-emerald-800 px-6 py-16 text-center sm:px-16 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            maskImage:
              'radial-gradient(ellipse 70% 70% at 50% 30%, black, transparent)',
            WebkitMaskImage:
              'radial-gradient(ellipse 70% 70% at 50% 30%, black, transparent)',
          }}
        />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl">
            Ready to run your business on WhatsApp?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-emerald-100/80">
            Join teams using wacrm to turn conversations into customers. Get
            started in minutes — no credit card required.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-6 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-50 sm:w-auto"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-white/25 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              Log in
            </Link>
          </div>
        </div>
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

// A polished, theme-aware image placeholder framed like an app window.
// Drop a real <Image>/<img> in place of the PlaceholderArea when the
// screenshots are ready — the frame + shadow stay.
function BrowserFrame({
  label,
  imageLabel,
  aspect,
  className,
}: {
  label?: string;
  imageLabel: string;
  aspect: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border bg-card overflow-hidden rounded-2xl border shadow-xl',
        className,
      )}
    >
      <div className="border-border bg-muted/40 flex items-center gap-1.5 border-b px-4 py-3">
        <span className="bg-foreground/15 h-3 w-3 rounded-full" />
        <span className="bg-foreground/15 h-3 w-3 rounded-full" />
        <span className="bg-foreground/15 h-3 w-3 rounded-full" />
        {label && (
          <span className="text-muted-foreground ml-3 truncate text-xs font-medium">
            {label}
          </span>
        )}
      </div>
      <PlaceholderArea label={imageLabel} className={aspect} />
    </div>
  );
}

function PlaceholderArea({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-muted/40 relative flex items-center justify-center',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(currentColor 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          color: 'rgba(120,120,120,0.12)',
        }}
      />
      <div className="text-muted-foreground/70 relative flex flex-col items-center gap-2">
        <ImageIcon className="h-7 w-7" strokeWidth={1.5} />
        <span className="text-xs font-medium tracking-wide">{label}</span>
      </div>
    </div>
  );
}

/* ─── Content ─────────────────────────────────────────────────────── */

const STATS = [
  { value: '1 inbox', label: 'For your whole team' },
  { value: 'Unlimited', label: 'Contacts & tags' },
  { value: 'Bulk', label: 'Broadcast campaigns' },
  { value: '100%', label: 'Yours to host' },
] as const;

const FEATURES = [
  {
    icon: Inbox,
    title: 'Shared team inbox',
    description:
      'Every WhatsApp conversation in one place — assign chats, add notes, and reply together as a team.',
  },
  {
    icon: Send,
    title: 'Broadcast campaigns',
    description:
      'Reach thousands of contacts with approved templates and watch delivery and read stats in real time.',
  },
  {
    icon: Users,
    title: 'Contacts & CRM',
    description:
      'Custom fields, tags, and deal stages built around your pipeline — a full CRM, not just a chat list.',
  },
  {
    icon: Zap,
    title: 'Automations & flows',
    description:
      'Auto-reply, route conversations, and trigger follow-ups so the routine work runs itself.',
  },
  {
    icon: FileText,
    title: 'Message templates',
    description:
      'Create, submit, and manage WhatsApp templates without leaving the app or juggling Meta Manager.',
  },
  {
    icon: BarChart3,
    title: 'Analytics dashboard',
    description:
      'Live insight into conversations, response times, campaigns, and deals — all on one screen.',
  },
] as const;

const SPOTLIGHTS = [
  {
    eyebrow: 'Shared team inbox',
    title: 'Every conversation, assigned and never dropped',
    body: 'Your whole team works from a single WhatsApp inbox. Assign chats, leave internal notes, and see the full history for every contact — so nothing falls through the cracks.',
    points: [
      'Assign conversations so everyone knows who owns what',
      'Private team notes on any chat or contact',
      'Full contact history at your fingertips',
      'The 24-hour messaging window, tracked for you',
    ],
    frameLabel: 'wacrm · Inbox',
    imageLabel: 'Shared inbox screenshot',
    reverse: false,
  },
  {
    eyebrow: 'Campaigns & automations',
    title: 'Turn one message into thousands of conversations',
    body: 'Launch broadcast campaigns with approved templates, then let automations follow up, route, and reply — so your outreach scales without more hands on deck.',
    points: [
      'Send bulk campaigns and track delivery & read rates live',
      'Auto-reply and route chats with no-code flows',
      'Trigger follow-ups on tags, replies, and deal stages',
      'Segment contacts to reach exactly the right people',
    ],
    frameLabel: 'wacrm · Campaigns',
    imageLabel: 'Campaign builder screenshot',
    reverse: true,
  },
] as const;

const STEPS = [
  {
    title: 'Connect WhatsApp',
    description:
      'Link your WhatsApp Business number in a few clicks using the official Business API.',
  },
  {
    title: 'Import your contacts',
    description:
      'Bring in contacts by CSV or add them as they message you — tag and organize as you go.',
  },
  {
    title: 'Message & grow',
    description:
      'Reply from the shared inbox, launch campaigns, and let automations handle the rest.',
  },
] as const;

const TESTIMONIALS = [
  {
    quote:
      'We run every customer conversation, broadcast, and follow-up through wacrm now. Our whole team finally works from the same inbox.',
    name: 'Bettie Porter',
    role: 'Senior Marketing Manager',
    initials: 'BP',
    gradient: 'from-emerald-400 to-emerald-600',
  },
  {
    quote:
      'Response times dropped from hours to minutes. Assigning chats and leaving internal notes changed how our support team works.',
    name: 'Marco Diaz',
    role: 'Head of Customer Support',
    initials: 'MD',
    gradient: 'from-sky-400 to-blue-600',
  },
  {
    quote:
      'The broadcast campaigns pay for the tool by themselves. We see delivery and read rates live, and follow-ups run on autopilot.',
    name: 'Aisha Khan',
    role: 'E-commerce Founder',
    initials: 'AK',
    gradient: 'from-violet-400 to-indigo-600',
  },
] as const;

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
    q: 'What happens after the free trial?',
    a: 'Your 14-day trial includes every feature. When it ends, pick a plan to keep sending — your data, contacts, and history stay untouched either way.',
  },
  {
    q: 'Can I send bulk broadcast messages?',
    a: 'Yes — build campaigns on Meta-approved templates, target them with tags, lists, and segments, and watch delivery and read stats in real time.',
  },
  {
    q: 'Does wacrm support automations and chatbots?',
    a: 'Automations handle triggers and follow-ups (welcome messages, tag-based routing, reminders), and Flows let you build no-code chatbot journeys with buttons and menus.',
  },
  {
    q: 'Can I connect Instagram too?',
    a: 'Yes — plans with the Instagram channel bring your Instagram DMs into the same shared inbox, so one team handles both.',
  },
] as const;
