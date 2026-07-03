import type { Metadata } from 'next';
import Link from 'next/link';
import {
  MessageSquare,
  Inbox,
  Send,
  Users,
  Zap,
  FileText,
  BarChart3,
  CheckCheck,
  Check,
  ArrowRight,
  Quote,
} from 'lucide-react';

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

const btnPrimary =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover';
const btnGhost =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <TrustStrip />
        <Features />
        <Spotlight />
        <HowItWorks />
        <Testimonial />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ─── Header ──────────────────────────────────────────────────────── */

function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <MessageSquare className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">wacrm</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            How it works
          </a>
          <a
            href="#testimonial"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Customers
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className={`${btnGhost} hidden sm:inline-flex`}>
            Log in
          </Link>
          <Link href="/signup" className={btnPrimary}>
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ─── Hero ────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background glow + grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage:
            'radial-gradient(ellipse 70% 55% at 50% 0%, black, transparent)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 55% at 50% 0%, black, transparent)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />
          Built on the official WhatsApp Business API
        </span>

        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
          The WhatsApp CRM your{' '}
          <span className="text-primary">whole team</span> runs on
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground text-pretty sm:text-lg">
          Manage contacts, send broadcast campaigns, and reply to every
          conversation from one shared inbox. Simple to set up, powerful enough
          to scale.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/signup" className={`${btnPrimary} h-12 w-full px-6 sm:w-auto`}>
            Get started free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className={`${btnGhost} h-12 w-full border border-border px-6 sm:w-auto`}>
            Log in
          </Link>
        </div>

        <p className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-primary" /> No credit card required
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-primary" /> Self-hostable
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-primary" /> Set up in minutes
          </span>
        </p>

        <ProductMock />
      </div>
    </section>
  );
}

/* A polished, static "app window" mock for the hero. */
function ProductMock() {
  return (
    <div className="relative mx-auto mt-14 max-w-4xl">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/5">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-red-400/70" />
          <span className="h-3 w-3 rounded-full bg-amber-400/70" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
          <div className="ml-3 hidden h-6 flex-1 items-center rounded-md border border-border bg-background px-3 text-[11px] text-muted-foreground sm:flex">
            app.wacrm.com/inbox
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr] text-left">
          {/* Mini sidebar */}
          <div className="hidden w-40 flex-col gap-1 border-r border-border bg-muted/20 p-3 sm:flex">
            {[
              { icon: BarChart3, label: 'Dashboard' },
              { icon: Inbox, label: 'Inbox', active: true },
              { icon: Users, label: 'Contacts' },
              { icon: Send, label: 'Campaigns' },
            ].map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium ${
                  active
                    ? 'bg-primary-soft text-primary'
                    : 'text-muted-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </div>
            ))}
          </div>

          {/* Inbox */}
          <div className="grid grid-cols-[minmax(0,10rem)_1fr]">
            <div className="space-y-1 border-r border-border p-2.5">
              {HERO_CONVERSATIONS.map((c, i) => (
                <div
                  key={c.name}
                  className={`rounded-lg px-2.5 py-2 ${i === 0 ? 'bg-muted' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-primary"
                      style={{ background: 'var(--primary-soft)' }}
                    >
                      {c.name.charAt(0)}
                    </span>
                    <span className="truncate text-xs font-medium">{c.name}</span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {c.preview}
                  </p>
                </div>
              ))}
            </div>

            {/* Thread */}
            <div className="flex flex-col gap-2.5 bg-muted/10 p-4">
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card px-3 py-2 text-xs shadow-sm ring-1 ring-border">
                Hi! Do you ship internationally? 🌍
              </div>
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-xs text-primary-foreground">
                Yes we do — sending you the rates now.
              </div>
              <div className="ml-auto flex items-center gap-1 text-[10px] text-primary">
                <CheckCheck className="h-3 w-3" /> Delivered
              </div>
              <div className="mt-auto flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
                <span className="flex-1 text-[11px] text-muted-foreground">
                  Type a message…
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                  <Send className="h-3 w-3 text-primary-foreground" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Trust strip ─────────────────────────────────────────────────── */

function TrustStrip() {
  return (
    <section className="border-y border-border bg-card/50">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {s.value}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Features ────────────────────────────────────────────────────── */

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeading
        eyebrow="Everything in one place"
        title="One platform for every customer conversation"
        subtitle="From the first message to the closed deal — wacrm gives your team the tools to sell and support over WhatsApp, without switching apps."
      />

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="group rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-base font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Spotlight ───────────────────────────────────────────────────── */

function Spotlight() {
  return (
    <section className="border-y border-border bg-card/40">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-primary">Shared team inbox</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Every conversation, assigned and never dropped
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Your whole team works from a single WhatsApp inbox. Assign chats,
            leave internal notes, and see the full history for every contact —
            so nothing falls through the cracks.
          </p>
          <ul className="mt-6 space-y-3">
            {SPOTLIGHT_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-sm text-foreground">{point}</span>
              </li>
            ))}
          </ul>
          <Link href="/signup" className={`${btnPrimary} mt-8`}>
            Start free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Emerald inbox mock */}
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-950 via-emerald-900 to-emerald-800 p-6 shadow-xl sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 top-8 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl"
          />
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
                <MessageSquare className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold text-white">wacrm · Inbox</span>
            </div>
            <div className="grid grid-cols-[minmax(0,7rem)_1fr]">
              <div className="space-y-1 border-r border-white/10 p-2">
                {HERO_CONVERSATIONS.map((c, i) => (
                  <div
                    key={c.name}
                    className={`rounded-lg px-2 py-1.5 ${i === 0 ? 'bg-white/10' : ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-4 w-4 shrink-0 rounded-full bg-emerald-400/40" />
                      <span className="truncate text-[11px] font-medium text-white/90">
                        {c.name}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-white/50">
                      {c.preview}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-2.5 p-3">
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white/10 px-3 py-2 text-[11px] text-white/80">
                  Can I get a demo this week?
                </div>
                <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-[11px] text-primary-foreground">
                  Absolutely — does Thursday 2pm work?
                </div>
                <div className="ml-auto flex items-center gap-1 text-[9px] text-emerald-200/70">
                  <CheckCheck className="h-3 w-3" /> Read
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── How it works ────────────────────────────────────────────────── */

function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeading
        eyebrow="Up and running fast"
        title="Live in three simple steps"
        subtitle="No lengthy onboarding. Connect your number and start talking to customers today."
      />

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <div key={step.title} className="relative rounded-2xl border border-border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {i + 1}
            </div>
            <h3 className="mt-5 text-base font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Testimonial ─────────────────────────────────────────────────── */

function Testimonial() {
  return (
    <section id="testimonial" className="border-y border-border bg-card/40">
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Quote className="h-6 w-6" />
        </div>
        <blockquote className="mt-6 text-2xl font-semibold leading-snug tracking-tight text-balance sm:text-3xl">
          &ldquo;We run every customer conversation, broadcast, and follow-up
          through wacrm now. Our whole team finally works from the same
          inbox.&rdquo;
        </blockquote>
        <div className="mt-6 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            BP
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">Bettie Porter</p>
            <p className="text-sm text-muted-foreground">Senior Marketing Manager</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Final CTA ───────────────────────────────────────────────────── */

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-emerald-950 via-emerald-900 to-emerald-800 px-6 py-16 text-center sm:px-16">
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
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
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

/* ─── Footer ──────────────────────────────────────────────────────── */

function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <MessageSquare className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold tracking-tight">wacrm</span>
        </Link>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} wacrm · Self-hostable CRM for WhatsApp
        </p>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/login" className="text-muted-foreground transition-colors hover:text-foreground">
            Log in
          </Link>
          <Link href="/signup" className="text-muted-foreground transition-colors hover:text-foreground">
            Sign up
          </Link>
        </div>
      </div>
    </footer>
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
      <p className="text-sm font-semibold text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty">
        {subtitle}
      </p>
    </div>
  );
}

/* ─── Content ─────────────────────────────────────────────────────── */

const HERO_CONVERSATIONS = [
  { name: 'Bettie Porter', preview: 'Sounds perfect, thanks!' },
  { name: 'Marco Diaz', preview: 'Can I get a demo?' },
  { name: 'Aisha Khan', preview: 'Order #1043 update' },
] as const;

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

const SPOTLIGHT_POINTS = [
  'Assign conversations so everyone knows who owns what',
  'Private team notes on any chat or contact',
  'Full contact history at your fingertips',
  'The 24-hour messaging window, tracked for you',
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
