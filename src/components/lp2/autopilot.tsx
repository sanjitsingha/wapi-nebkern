import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Check,
  Clock,
  FileText,
  GitBranch,
  ListChecks,
  MessageCircle,
  Send,
  Sparkles,
  UserRound,
  Workflow,
  Zap,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { DotField, Highlight, Sparkle, Squiggle } from './decor';
import { Btn, SectionHead } from './ui';

// ============================================================
// /autopilot — the dedicated deep-dive on the three systems that
// answer, route, and follow up without a human touching every
// conversation: the RAG-trained AI Bot, visual Flows, and rule-based
// Automations.
//
// Three technologies get conflated under "AI Agents" everywhere else
// on the site; this page's whole job is to draw the lines between them
// clearly enough that a visitor knows which one they actually need —
// see AutopilotChooser at the bottom.
// ============================================================

const OVERVIEW = [
  {
    id: 'ai-bot',
    icon: Bot,
    hue: 'grape',
    name: 'AI Bot',
    tag: 'Understands',
    body: 'Trained on your own docs and FAQs. Answers open-ended questions in your voice, any time, any phrasing.',
  },
  {
    id: 'flows',
    icon: Workflow,
    hue: 'sky',
    name: 'Flows',
    tag: 'Guides',
    body: 'A visual canvas for multi-step conversations — buttons, lists, branches — that you design once.',
  },
  {
    id: 'automations',
    icon: Zap,
    hue: 'tangerine',
    name: 'Automations',
    tag: 'Reacts',
    body: 'Simple if-this-then-that rules. A trigger, a condition, an action — no canvas, no training.',
  },
] as const;

/* ═══════════════════════════ Hero ═══════════════════════════════ */

export function AutopilotHero() {
  return (
    <section className="relative -mt-19 overflow-hidden bg-(--lp2-grape-soft) pt-19 sm:-mt-20 sm:pt-20">
      <DotField />

      <div className="relative mx-auto max-w-4xl px-4 pt-14 pb-20 text-center sm:px-6 sm:pt-20 sm:pb-28">
        <span
          className="inline-flex items-center gap-2 rounded-full border-2 border-(--lp2-ink) bg-white px-3.5 py-1.5 text-xs font-bold shadow-(--lp2-shadow-sm)"
          style={{ transform: 'rotate(-1.5deg)' }}
        >
          <Sparkles className="size-3.5 text-(--lp2-grape)" strokeWidth={3} />
          Three systems, one job: never leave a customer waiting
        </span>

        <h1 className="lp2-display mt-6 text-4xl leading-[1.08] font-extrabold text-balance sm:text-6xl">
          Meet <Highlight color="grape">Autopilot</Highlight>.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-lg">
          Every reply that goes out without a human typing it comes from one
          of three places — an AI Bot that understands, a Flow that guides,
          or an Automation that reacts. Different jobs, different tools,
          working the same inbox.
        </p>

        <div className="mt-9 flex justify-center">
          <Btn href="/signup">
            Start free trial
            <ArrowRight className="size-5" strokeWidth={2.75} />
          </Btn>
        </div>

        {/* Three converging paths → one WhatsApp bubble. The whole
            argument of the page, drawn before a word of the sections
            below is read. */}
        <ConvergenceDiagram />
      </div>
    </section>
  );
}

function ConvergenceDiagram() {
  return (
    <div className="relative mx-auto mt-16 hidden max-w-3xl sm:block">
      <svg viewBox="0 0 600 140" className="w-full" aria-hidden>
        <path d="M60 20 C 220 20, 260 70, 300 70" fill="none" stroke="var(--lp2-ink)" strokeOpacity="0.25" strokeWidth="2.5" strokeDasharray="6 7" />
        <path d="M300 70 L 300 70" fill="none" stroke="var(--lp2-ink)" strokeOpacity="0.25" strokeWidth="2.5" />
        <path d="M60 70 L 300 70" fill="none" stroke="var(--lp2-ink)" strokeOpacity="0.25" strokeWidth="2.5" strokeDasharray="6 7" />
        <path d="M60 120 C 220 120, 260 70, 300 70" fill="none" stroke="var(--lp2-ink)" strokeOpacity="0.25" strokeWidth="2.5" strokeDasharray="6 7" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-between px-0">
        <MiniNode icon={Bot} hue="grape" label="AI Bot" top="0%" />
        <MiniNode icon={Workflow} hue="sky" label="Flows" top="43%" />
        <MiniNode icon={Zap} hue="tangerine" label="Automations" top="86%" />
        <span className="ml-auto flex flex-col items-center gap-1.5">
          <span className="flex size-14 items-center justify-center rounded-full border-2 border-(--lp2-ink) bg-white shadow-(--lp2-shadow-sm)">
            <MessageCircle className="size-6 text-(--lp2-grass)" strokeWidth={2.5} />
          </span>
          <span className="text-xs font-bold">Your inbox</span>
        </span>
      </div>
    </div>
  );
}

function MiniNode({
  icon: Icon,
  hue,
  label,
  top,
}: {
  icon: typeof Bot;
  hue: string;
  label: string;
  top: string;
}) {
  return (
    <span
      className="absolute left-0 flex -translate-y-1/2 flex-col items-center gap-1.5"
      style={{ top }}
    >
      <span
        className="flex size-12 items-center justify-center rounded-full border-2 border-(--lp2-ink)"
        style={{ backgroundColor: `var(--lp2-${hue})` }}
      >
        <Icon className="size-5" strokeWidth={2.5} />
      </span>
      <span className="text-xs font-bold whitespace-nowrap">{label}</span>
    </span>
  );
}

/* ═══════════════════════════ Overview strip ══════════════════════ */

export function AutopilotOverview() {
  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-3">
          {OVERVIEW.map((o) => (
            <a
              key={o.id}
              href={`#${o.id}`}
              className="group flex flex-col rounded-2xl border-2 border-(--lp2-ink) bg-white p-6 transition-transform hover:-translate-y-1"
            >
              <span
                className="flex size-11 items-center justify-center rounded-xl border-2 border-(--lp2-ink)"
                style={{ backgroundColor: `var(--lp2-${o.hue}-soft)` }}
              >
                <o.icon className="size-5" style={{ color: `var(--lp2-${o.hue})` }} strokeWidth={2.5} />
              </span>
              <p className="lp2-display mt-4 flex items-center gap-2 text-lg font-extrabold">
                {o.name}
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase"
                  style={{ backgroundColor: `var(--lp2-${o.hue}-soft)` }}
                >
                  {o.tag}
                </span>
              </p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-(--lp2-ink-soft)">
                {o.body}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-(--lp2-ink) group-hover:text-(--lp2-grass-deep)">
                See how it works
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════ AI Bot section ══════════════════════ */

const AI_PROOF = [
  { icon: FileText, text: 'Reads your catalogue, policies and FAQs once — not the open internet' },
  { icon: Sparkles, text: 'Test any change in the playground before a customer ever sees it' },
  { icon: UserRound, text: "Hands off to a human the moment it isn't confident" },
  { icon: Clock, text: 'Waits a beat for a burst of messages, then answers once — not once per message' },
];

export function AutopilotAiBot() {
  return (
    <section id="ai-bot" className="scroll-mt-24 bg-(--lp2-grape-soft)/40 py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="lp2-display text-3xl leading-[1.1] font-extrabold text-balance sm:text-[2.5rem]">
            The one that actually{' '}
            <Highlight color="grape">understands</Highlight> the question.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-lg">
            Retrieval-augmented, not scripted — it searches your own
            knowledge base for the closest real answer, then writes a reply
            in context. Ask it the same thing five different ways; it holds
            up all five times.
          </p>

          <ul className="mt-7 space-y-3.5">
            {AI_PROOF.map((p) => (
              <li key={p.text} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-(--lp2-grape-soft)">
                  <p.icon className="size-3.5 text-(--lp2-grape)" strokeWidth={2.75} />
                </span>
                <span className="text-sm leading-relaxed font-medium sm:text-base">{p.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <AiBotCard />
      </div>
    </section>
  );
}

function AiBotCard() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-2xl border-2 border-(--lp2-ink) bg-white p-5 shadow-(--lp2-shadow-lg)">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-(--lp2-grape)">
            <Bot className="size-5 text-white" strokeWidth={2.5} />
          </span>
          <div>
            <p className="lp2-display text-base font-extrabold">Your AI Bot</p>
            <p className="flex items-center gap-1.5 text-xs font-bold text-(--lp2-ink-soft)">
              <span className="size-2 rounded-full bg-(--lp2-grass)" />
              Trained on 12 documents
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-(--lp2-cream) px-3.5 py-2.5 text-[13px] font-medium">
            Do you ship the blue one to Kochi, and is COD available?
          </div>
          <div className="w-fit max-w-[90%] rounded-2xl rounded-bl-md border-2 border-(--lp2-ink) bg-(--lp2-mint) px-3.5 py-2.5 text-[13px] font-medium shadow-[2px_2px_0_var(--lp2-ink)]">
            <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-(--lp2-lemon) px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase">
              <Sparkles className="size-2.5" strokeWidth={3} /> AI Bot
            </span>
            <p className="leading-snug">
              Yes to both — blue ships to Kochi in 3–4 days, and Cash on
              Delivery is available on that pincode. Want me to start the order?
            </p>
          </div>
        </div>

        <p className="mt-3 text-center text-xs font-bold text-(--lp2-ink-soft)">
          Answered from your shipping policy · 3 seconds
        </p>
      </div>
      <Sparkle color="lemon" className="absolute -top-5 -right-4 size-7" />
      <Squiggle color="sky" className="absolute -bottom-4 -left-6 hidden w-14 rotate-12 lg:block" />
    </div>
  );
}

/* ═══════════════════════════ Flows section ═══════════════════════ */

export function AutopilotFlows() {
  return (
    <section id="flows" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead
          hue="sky"
          title="A conversation that branches, exactly where you decide."
          highlight="branches"
          subtitle="Buttons, lists, a date picker, a question that captures the answer — chained on a canvas. Design the journey once; every customer who starts it gets routed down the right path automatically."
        />

        <div className="mt-14">
          <FlowBranchDiagram />
        </div>

        <div className="mt-10 flex justify-center">
          <Btn href="/signup" variant="plain">
            Build your first flow
            <ArrowRight className="size-5" strokeWidth={2.75} />
          </Btn>
        </div>
      </div>
    </section>
  );
}

function FlowBranchDiagram() {
  return (
    <div className="mx-auto max-w-4xl overflow-x-auto">
      <div className="flex min-w-[720px] justify-center gap-3">
        <FlowChip icon={Zap} hue="sky" label="Trigger" title={'Keyword: "book a demo"'} />
        <FlowArrow />
        <FlowChip icon={ListChecks} hue="lemon" label="Send list" title="Pick a time slot" />
        <FlowArrow branch />
      </div>
      <div className="mt-3 flex min-w-[720px] justify-end gap-3 pl-[19.5rem]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <FlowChip icon={GitBranch} hue="grape" label="If/else" title="Slot still open?" small />
            <FlowArrow />
            <FlowChip icon={Send} hue="grass" label="Send message" title="Confirmed! See you then." small solid />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0" />
            <FlowArrow />
            <FlowChip icon={UserRound} hue="coral" label="Handoff" title="No slots left → notify Sales" small />
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowChip({
  icon: Icon,
  hue,
  label,
  title,
  small = false,
  solid = false,
}: {
  icon: typeof Bot;
  hue: string;
  label: string;
  title: string;
  small?: boolean;
  solid?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2.5 rounded-xl border-2 border-(--lp2-ink) bg-white p-3',
        small ? 'w-52' : 'w-56',
      )}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `var(--lp2-${hue}${solid ? '' : '-soft'})` }}
      >
        <Icon
          className={cn('size-4.5', solid && 'text-white')}
          style={!solid ? { color: `var(--lp2-${hue})` } : undefined}
          strokeWidth={2.5}
        />
      </span>
      <div className="min-w-0">
        <span className="block text-[10px] font-extrabold tracking-wide text-(--lp2-ink-soft) uppercase">
          {label}
        </span>
        <span className="block truncate text-sm font-bold">{title}</span>
      </div>
    </div>
  );
}

function FlowArrow({ branch = false }: { branch?: boolean }) {
  return (
    <div className="flex shrink-0 items-center justify-center self-center" aria-hidden>
      <svg viewBox="0 0 40 16" className="h-4 w-8">
        <path
          d={branch ? 'M2 8 H30 M24 3 L30 8 L24 13' : 'M2 8 H30 M24 3 L30 8 L24 13'}
          fill="none"
          stroke="var(--lp2-ink)"
          strokeOpacity="0.4"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/* ═══════════════════════════ Automations section ═════════════════ */

const AUTOMATION_RULES = [
  {
    hue: 'tangerine',
    trigger: 'New message contains "refund"',
    actions: ['Tag: Support', 'Assign: Priya'],
  },
  {
    hue: 'coral',
    trigger: 'First message from a new contact',
    actions: ['Send template: Welcome'],
  },
  {
    hue: 'sky',
    trigger: 'Message arrives after 9pm',
    actions: ['Send message: "Back online at 9am"'],
  },
] as const;

export function AutopilotAutomations() {
  return (
    <section id="automations" className="scroll-mt-24 bg-(--lp2-tangerine-soft)/40 py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <RuleList />

        <div className="lg:order-first">
          <h2 className="lp2-display text-3xl leading-[1.1] font-extrabold text-balance sm:text-[2.5rem]">
            One rule, no canvas.{' '}
            <Highlight color="tangerine">Instant.</Highlight>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-lg">
            When a Flow is too much for what you need — one trigger, one or
            two actions, done — an Automation runs it the moment a message
            matches. No screens to design, nothing to test in a playground.
          </p>

          <ul className="mt-7 space-y-3">
            {[
              'Pick a trigger: a keyword, a new contact, a tag, the time of day',
              'Stack actions: tag, assign, reply, send a template, create a deal',
              'Runs on every matching message, forever, until you turn it off',
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-(--lp2-pop)">
                  <Check className="size-3.5" strokeWidth={4} />
                </span>
                <span className="text-sm leading-relaxed font-medium sm:text-base">{t}</span>
              </li>
            ))}
          </ul>

          <Btn href="/signup" className="mt-9">
            Set up an automation
            <ArrowRight className="size-5" strokeWidth={2.75} />
          </Btn>
        </div>
      </div>
    </section>
  );
}

function RuleList() {
  return (
    <div className="mx-auto w-full max-w-md space-y-3">
      {AUTOMATION_RULES.map((r, i) => (
        <div
          key={i}
          className="rounded-xl border-2 border-(--lp2-ink) bg-white p-4"
        >
          <div className="flex items-center gap-2.5">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `var(--lp2-${r.hue}-soft)` }}
            >
              <Zap className="size-4" style={{ color: `var(--lp2-${r.hue})` }} strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <span className="block text-[10px] font-extrabold tracking-wide text-(--lp2-ink-soft) uppercase">
                Trigger
              </span>
              <span className="block truncate text-sm font-bold">{r.trigger}</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 pl-[2.75rem]">
            {r.actions.map((a) => (
              <span
                key={a}
                className="rounded-full bg-(--lp2-cream) px-2.5 py-1 text-[11px] font-bold"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════ Chooser ═════════════════════════════ */

const CHOICES = [
  {
    icon: Bot,
    hue: 'grape',
    when: 'A customer could ask literally anything',
    use: 'AI Bot',
  },
  {
    icon: Workflow,
    hue: 'sky',
    when: 'You want to guide them through a specific journey',
    use: 'Flows',
  },
  {
    icon: Zap,
    hue: 'tangerine',
    when: "It's one clear if-this-then-that rule",
    use: 'Automations',
  },
] as const;

export function AutopilotChooser() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHead
          hue="lemon"
          title="You don't have to pick just one."
          highlight="just one"
          subtitle="Most accounts run all three side by side — the AI Bot handles the open-ended stuff, a Flow owns your lead-capture journey, and a couple of Automations quietly tag and route everything else."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {CHOICES.map((c) => (
            <div
              key={c.use}
              className="rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-cream) p-6 text-center"
            >
              <span
                className="mx-auto flex size-12 items-center justify-center rounded-full border-2 border-(--lp2-ink)"
                style={{ backgroundColor: `var(--lp2-${c.hue}-soft)` }}
              >
                <c.icon className="size-5" style={{ color: `var(--lp2-${c.hue})` }} strokeWidth={2.5} />
              </span>
              <p className="mt-4 text-sm leading-relaxed font-medium text-(--lp2-ink-soft)">
                &ldquo;{c.when}&rdquo;
              </p>
              <p className="lp2-display mt-3 text-lg font-extrabold">→ {c.use}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════ Shared bits ═════════════════════════ */

/** Small link back to this page, dropped into the homepage's existing
 *  AI/automation sections so they funnel here for the full picture.
 *  No margin of its own — callers control spacing since it's placed
 *  differently in each section (inline beside a button, or stacked
 *  below one). */
export function AutopilotTeaserLink() {
  return (
    <Link
      href="/autopilot"
      className="inline-flex items-center gap-1 text-sm font-bold text-(--lp2-ink) hover:text-(--lp2-grass-deep)"
    >
      See all three, side by side
      <ArrowRight className="size-3.5" strokeWidth={2.75} />
    </Link>
  );
}
