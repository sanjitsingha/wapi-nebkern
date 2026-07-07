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
    <div className="bg-background text-foreground flex min-h-screen flex-col">
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
    <header className="border-border/70 bg-background/80 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
            <MessageSquare className="text-primary-foreground h-4.5 w-4.5" />
          </div>
          <span className="text-lg font-bold tracking-tight">wacrm</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            How it works
          </a>
          <a
            href="#testimonial"
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
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
        className="bg-primary/10 pointer-events-none absolute -top-40 left-1/2 -z-10 h-96 w-[42rem] -translate-x-1/2 rounded-full blur-3xl"
      />

      {/* Floating avatars + chat bubbles — decorative, live in the side
          margins on large screens so they frame the headline like the
          conversations they represent. Hidden on smaller screens where they'd
          collide with the copy. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 mx-auto hidden max-w-6xl lg:block"
      >
        {/* left column */}
        <FloatAvatar
          initials="AD"
          gradient="from-emerald-400 to-emerald-600"
          size={56}
          delay={0}
          online
          className="top-28 left-2"
        />
        <div className="animate-floaty bg-card text-foreground ring-border absolute top-[6.5rem] left-20 rounded-2xl rounded-bl-sm px-3 py-1.5 text-xs font-medium shadow-md ring-1">
          New order received! 🎉
        </div>
        <FloatAvatar
          initials="LT"
          gradient="from-rose-400 to-pink-600"
          size={48}
          delay={2.4}
          className="top-64 left-16"
        />
        <FloatAvatar
          initials="KP"
          gradient="from-amber-400 to-orange-600"
          size={52}
          delay={1.8}
          className="top-[26rem] left-6"
        />

        {/* right column */}
        <FloatAvatar
          initials="MJ"
          gradient="from-sky-400 to-blue-600"
          size={54}
          delay={1.2}
          online
          className="top-24 right-4"
        />
        <FloatAvatar
          initials="SR"
          gradient="from-violet-400 to-indigo-600"
          size={50}
          delay={0.6}
          className="top-60 right-16"
        />
        <FloatAvatar
          initials="PT"
          gradient="from-teal-400 to-emerald-600"
          size={58}
          delay={3}
          className="top-[25rem] right-6"
        />
        <div className="animate-floaty bg-primary text-primary-foreground absolute top-[24rem] right-24 rounded-2xl rounded-br-sm px-3 py-1.5 text-xs font-medium shadow-md">
          I want a black T-shirt…
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24">
        <span className="border-border bg-card text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
          <span className="bg-primary flex h-1.5 w-1.5 rounded-full" />
          Built on the official WhatsApp Business API
        </span>

        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
          Increase orders, secure more bookings, and delight every customer{' '}
          <span className="text-primary">effortlessly</span>
        </h1>

        <p className="text-muted-foreground mx-auto mt-5 max-w-xl text-base text-pretty sm:text-lg">
          wacrm brings your contacts, broadcast campaigns, and every WhatsApp
          conversation into one shared inbox — so your whole team can sell and
          support without switching apps.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
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

        <p className="text-muted-foreground mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs">
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

        <ProductMock />
      </div>
    </section>
  );
}

/* A polished, static "app window" mock for the hero. */
function ProductMock() {
  return (
    <div className="relative mx-auto mt-14 max-w-4xl">
      <div className="border-border bg-card shadow-primary/5 overflow-hidden rounded-2xl border shadow-2xl">
        {/* Window chrome */}
        <div className="border-border bg-muted/40 flex items-center gap-2 border-b px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-red-400/70" />
          <span className="h-3 w-3 rounded-full bg-amber-400/70" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
          <div className="border-border bg-background text-muted-foreground ml-3 hidden h-6 flex-1 items-center rounded-md border px-3 text-[11px] sm:flex">
            app.wacrm.com/inbox
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr] text-left">
          {/* Mini sidebar */}
          <div className="border-border bg-muted/20 hidden w-40 flex-col gap-1 border-r p-3 sm:flex">
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
            <div className="border-border space-y-1 border-r p-2.5">
              {HERO_CONVERSATIONS.map((c, i) => (
                <div
                  key={c.name}
                  className={`rounded-lg px-2.5 py-2 ${i === 0 ? 'bg-muted' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                      style={{ background: 'var(--primary-soft)' }}
                    >
                      {c.name.charAt(0)}
                    </span>
                    <span className="truncate text-xs font-medium">
                      {c.name}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 truncate text-[11px]">
                    {c.preview}
                  </p>
                </div>
              ))}
            </div>

            {/* Thread */}
            <div className="bg-muted/10 flex flex-col gap-2.5 p-4">
              <div className="bg-card ring-border max-w-[85%] rounded-2xl rounded-tl-sm px-3 py-2 text-xs shadow-sm ring-1">
                Hi! Do you ship internationally? 🌍
              </div>
              <div className="bg-primary text-primary-foreground ml-auto max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-2 text-xs">
                Yes we do — sending you the rates now.
              </div>
              <div className="text-primary ml-auto flex items-center gap-1 text-[10px]">
                <CheckCheck className="h-3 w-3" /> Delivered
              </div>
              <div className="border-border bg-background mt-auto flex items-center gap-2 rounded-full border px-3 py-2">
                <span className="text-muted-foreground flex-1 text-[11px]">
                  Type a message…
                </span>
                <span className="bg-primary flex h-6 w-6 items-center justify-center rounded-full">
                  <Send className="text-primary-foreground h-3 w-3" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Hero floating avatar ────────────────────────────────────────── */

// Floating avatar for the marketing hero. `delay` staggers the drift so the
// group never bobs in unison; `online` adds the WhatsApp-style green dot.
function FloatAvatar({
  initials,
  gradient,
  size = 56,
  delay = 0,
  online = false,
  className = '',
}: {
  initials: string;
  gradient: string;
  size?: number;
  delay?: number;
  online?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`animate-floaty absolute ${className}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="relative">
        <div
          className={`ring-background flex items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-semibold text-white shadow-lg ring-4`}
          style={{ height: size, width: size, fontSize: size * 0.32 }}
        >
          {initials}
        </div>
        {online && (
          <span className="ring-background absolute right-0 bottom-0 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2" />
        )}
      </div>
    </div>
  );
}

/* ─── Trust strip ─────────────────────────────────────────────────── */

function TrustStrip() {
  return (
    <section className="border-border bg-card/50 border-y">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-foreground text-3xl font-bold tracking-tight">
              {s.value}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">{s.label}</p>
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
            className="group border-border bg-card rounded-2xl border p-6 transition-shadow hover:shadow-md"
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

/* ─── Spotlight ───────────────────────────────────────────────────── */

function Spotlight() {
  return (
    <section className="border-border bg-card/40 border-y">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-primary text-sm font-semibold">
            Shared team inbox
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Every conversation, assigned and never dropped
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed">
            Your whole team works from a single WhatsApp inbox. Assign chats,
            leave internal notes, and see the full history for every contact —
            so nothing falls through the cracks.
          </p>
          <ul className="mt-6 space-y-3">
            {SPOTLIGHT_POINTS.map((point) => (
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

        {/* Emerald inbox mock */}
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-950 via-emerald-900 to-emerald-800 p-6 shadow-xl sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute top-8 -right-16 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl"
          />
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
              <div className="bg-primary flex h-6 w-6 items-center justify-center rounded-md">
                <MessageSquare className="text-primary-foreground h-3.5 w-3.5" />
              </div>
              <span className="text-sm font-semibold text-white">
                wacrm · Inbox
              </span>
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
                <div className="bg-primary text-primary-foreground ml-auto max-w-[80%] rounded-2xl rounded-tr-sm px-3 py-2 text-[11px]">
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
          <div
            key={step.title}
            className="border-border bg-card relative rounded-2xl border p-6"
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

/* ─── Testimonial ─────────────────────────────────────────────────── */

function Testimonial() {
  return (
    <section id="testimonial" className="border-border bg-card/40 border-y">
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <div className="bg-primary-soft text-primary mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
          <Quote className="h-6 w-6" />
        </div>
        <blockquote className="mt-6 text-2xl leading-snug font-semibold tracking-tight text-balance sm:text-3xl">
          &ldquo;We run every customer conversation, broadcast, and follow-up
          through wacrm now. Our whole team finally works from the same
          inbox.&rdquo;
        </blockquote>
        <div className="mt-6 flex items-center justify-center gap-3">
          <div className="bg-primary text-primary-foreground flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold">
            BP
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">Bettie Porter</p>
            <p className="text-muted-foreground text-sm">
              Senior Marketing Manager
            </p>
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
    <footer className="border-border border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="bg-primary flex h-7 w-7 items-center justify-center rounded-lg">
            <MessageSquare className="text-primary-foreground h-4 w-4" />
          </div>
          <span className="font-bold tracking-tight">wacrm</span>
        </Link>
        <p className="text-muted-foreground text-xs">
          © {new Date().getFullYear()} wacrm · Self-hostable CRM for WhatsApp
        </p>
        <div className="flex items-center gap-6 text-sm">
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
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
