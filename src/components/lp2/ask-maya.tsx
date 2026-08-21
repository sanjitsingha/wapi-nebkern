import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Clock,
  FileText,
  GitBranch,
  ListChecks,
  Send,
  Sparkles,
  UserRound,
  Workflow,
  Zap,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { DotField, Highlight, Sparkle, Squiggle } from './decor';
import { MayaLockup } from './maya-lockup';
import { Btn, SectionHead } from './ui';

// ============================================================
// /ask-maya — the dedicated deep-dive on the three systems that
// answer, route, and follow up without a human touching every
// conversation: Maya herself (RAG-trained on your knowledge base),
// visual Flows, and rule-based Automations.
//
// Three technologies get conflated under "AI Agents" everywhere else
// on the site; this page's whole job is to draw the lines between them
// clearly enough that a visitor knows which one they actually need —
// see MayaChooser at the bottom.
//
// Named after the assistant rather than the mechanism ("Autopilot",
// as this page was called until the rebrand): people ask a colleague
// for something, not a subsystem, and Maya is who they meet in the
// product. The old /autopilot URL 308s here, via next.config.ts.
//
// Colour: Maya owns `--lp2-maya` / `--lp2-lime` — the greens sampled
// from her lockup. NOT `--lp2-grass`, which is the company brand; the
// two greens sit deliberately apart so the assistant never reads as
// the whole product. Flows and Automations keep sky and tangerine, so
// the page still shows three distinguishable systems at a glance.
// ============================================================

const OVERVIEW = [
  {
    id: 'maya',
    icon: Sparkles,
    hue: 'maya',
    name: 'Maya',
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

export function MayaHero() {
  return (
    <section className="relative -mt-19 overflow-hidden bg-(--lp2-maya-soft) pt-19 sm:-mt-20 sm:pt-20">
      <DotField />

      <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-20 sm:px-6 sm:pt-20 sm:pb-28">
        {/* The badge, paragraph and CTA that used to fill the hero are
            gone; the window is the whole of it now. The page's h1 lives
            inside, on the lockup — see MayaWindow. */}
        <MayaWindow />
      </div>
    </section>
  );
}

/** The exchange inside the window.
 *
 *  A different question from the one MayaChatCard answers further down.
 *  Both are good demonstrations, but running the same shipping-and-COD
 *  exchange twice on one page makes the second read as a repeat rather
 *  than a second proof.
 *
 *  Three turns, ending on the customer — so the typing indicator that
 *  follows has someone to be waiting for, and the conversation reads as
 *  still running rather than stopped. */
const HERO_THREAD = [
  { side: 'in', text: 'My order says delivered but nothing arrived 😕' },
  {
    side: 'out',
    text: "I can see it was left with your building's reception at 2:14pm. If it isn't there, I'll raise a claim now — shall I?",
  },
  { side: 'in', text: 'Yes please, go ahead 🙏' },
] as const;

/** Each bubble waits this much longer than the one before it. */
const STAGGER_MS = 550;

/**
 * The hero's window — a plain white panel, no browser chrome.
 *
 * Same handwriting as every other large surface on the site — 2px ink
 * outline plus the hard offset shadow — sized up to `shadow-lg` for the
 * reason apart.tsx gives: under a box this big the 4px offset stops
 * reading as solid and starts looking like a misprint.
 *
 * Height comes from `aspect-video` on desktop, but a fixed minimum on
 * phones: 16:9 across a 350px screen is under 200px tall, which the
 * lockup and two bubbles do not fit inside. The ratio is a nice-to-have
 * for the window's proportion; legible content is not, so the ratio is
 * what gives way at the narrow end.
 */
function MayaWindow() {
  return (
    <div className="flex min-h-[30rem] w-full flex-col rounded-2xl border-2 border-(--lp2-ink) bg-white px-5 pt-7 pb-5 shadow-(--lp2-shadow-lg) sm:aspect-video sm:min-h-0 sm:rounded-3xl sm:px-8 sm:pt-8 sm:pb-6">
      {/* The lockup is the page's h1: it spells the page's name, and
          its alt text ("ask maya") is what a screen reader announces
          and what a search result shows. Nothing else on the page is
          a heading of this rank.

          Sized as a share of the window rather than in pixels, so the
          mark keeps its proportion to the panel at every breakpoint —
          a fixed width would swamp the box on a phone and get lost in
          it on a desktop. `max-w-full` is the guard for the narrowest
          screens. See MayaLockup: scale by width, never by height. */}
      <h1 className="flex w-[38%] max-w-full min-w-[150px] shrink-0 justify-center self-center">
        <MayaLockup variant="ask" height={92} priority className="w-full" />
      </h1>

      {/* Status line under the mark. Fills the gap the lockup used to
          leave and does a job while it is there: it says the thing a
          hero paragraph would have said, in the register of a chat
          window rather than a pitch. */}
      <p className="mt-3 flex shrink-0 items-center justify-center gap-2 self-center text-[11px] font-bold text-(--lp2-ink-soft) sm:text-xs">
        <span className="size-2 rounded-full bg-(--lp2-maya)" />
        Trained on your docs · replies in seconds · never off duty
      </p>

      {/* The conversation, in the same speech-bubble vocabulary as the
          "10X your performance with Maya" cards on the landing page —
          see HeroBubble for why it is a copy rather than a shared
          import.

          `flex-1` + `justify-end` is what stops the window looking
          half-empty: the thread grows from the composer upward, the way
          a real chat does, so any leftover height collects between the
          mark and the first bubble instead of pooling at the bottom. */}
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-end gap-3.5 py-6 sm:gap-4">
        {HERO_THREAD.map((m, i) => (
          // Staggered so the turns land in sequence and read as a
          // question ANSWERED, not three boxes appearing at once. Each
          // waits long enough to feel like a reply — but well short of
          // a real pause, since nobody watches a hero for that long.
          <HeroBubble
            key={m.text}
            side={m.side}
            text={m.text}
            delayMs={i * STAGGER_MS}
          />
        ))}

        {/* Maya starting her next reply. The conversation is left
            running rather than finished, which is the point of the
            whole panel — and it gives the eye something moving to land
            on after the entrance animations have all played out. */}
        <TypingBubble delayMs={HERO_THREAD.length * STAGGER_MS} />
      </div>

      {/* A composer, greyed and inert. Not a real input: there is
          nothing on this page for a typed message to go to, and a box
          that accepts text and does nothing is worse than one that
          plainly does not. `aria-hidden` for the same reason — it is a
          picture of an input, so a screen reader should not offer it as
          one. It anchors the bottom edge the way a titlebar would have
          anchored the top. */}
      <div
        aria-hidden
        className="mx-auto flex w-full max-w-xl shrink-0 items-center gap-3 rounded-full border-2 border-(--lp2-ink)/15 bg-(--lp2-cream) px-4 py-2.5 sm:px-5 sm:py-3"
      >
        <span className="flex-1 truncate text-[13px] font-medium text-(--lp2-ink-soft)/60 sm:text-sm">
          Ask Maya anything…
        </span>
        {/* Ink glyph, not white: white on `--lp2-maya` is 2.46:1 and
            the arrow disappears into the button. Ink is 7.13:1 there —
            the same reason lp2.css says ink on the greens, never
            white. */}
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-(--lp2-ink) bg-(--lp2-maya) sm:size-8">
          <Send className="size-3.5 text-(--lp2-ink)" strokeWidth={2.75} />
        </span>
      </div>
    </div>
  );
}

/** Maya composing — the three-dot indicator, using the `lp2-typing-dot`
 *  keyframe that has been sitting in lp2.css unused. Shaped as a bubble
 *  on her side of the thread so it reads as her turn, not a spinner. */
function TypingBubble({ delayMs }: { delayMs: number }) {
  return (
    <div
      className="lp2-bubble-in flex justify-end"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span
        className="flex items-center gap-1.5 rounded-2xl rounded-br-md border-2 border-(--lp2-ink) bg-(--lp2-mint) px-4 py-3 shadow-[3px_3px_0_var(--lp2-ink)]"
        // Announced as a status rather than read as three empty spans.
        role="status"
        aria-label="Maya is typing"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="lp2-typing-dot size-1.5 rounded-full bg-(--lp2-maya-deep)"
            // The three dots run the same 1.4s loop a beat apart, which
            // is what makes it a wave rather than a blink.
            style={{ animationDelay: `${delayMs + i * 160}ms` }}
          />
        ))}
      </span>
    </div>
  );
}

/**
 * A speech bubble, matching Lp2AiPerformance's `Bubble` exactly — the
 * squared-off corner on the speaker's side, the ink outline, the 2px
 * offset shadow, mint for Maya and white for the customer.
 *
 * Deliberately a copy rather than an import: that one is a private
 * helper inside ai-performance.tsx, and its badge reads "AI" where this
 * page names her outright. Two small components that happen to look
 * alike is the cheaper mistake here; exporting it would tie a landing
 * page section's internals to this page's hero. If a third caller ever
 * wants it, that is the point to lift it into decor.tsx properly.
 */
function HeroBubble({
  side,
  text,
  delayMs = 0,
}: {
  side: 'in' | 'out';
  text: string;
  /** Staggers the entrance. The CSS uses `backwards` fill, so the
   *  bubble stays invisible through the delay rather than flashing. */
  delayMs?: number;
}) {
  const out = side === 'out';
  return (
    <div
      className={cn(
        'lp2-bubble-in flex',
        out ? 'justify-end' : 'justify-start',
      )}
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      <div
        className={cn(
          'max-w-[88%] rounded-2xl border-2 border-(--lp2-ink) px-4 py-3 text-sm leading-relaxed font-medium shadow-[3px_3px_0_var(--lp2-ink)] sm:px-5 sm:py-3.5 sm:text-base',
          out ? 'rounded-br-md bg-(--lp2-mint)' : 'rounded-bl-md bg-white',
        )}
      >
        {out && (
          // Her actual mark, not her name set in type. The chip is
          // sized off the lockup's own ratio (1351 × 493 ≈ 2.74:1), so
          // the pill hugs it instead of leaving air either side.
          //
          // White backing, NOT the lime the text chip used: the lockup
          // is `--lp2-maya` green, which lands at 1.69:1 against lime —
          // the mark all but vanishes into its own chip. White gives it
          // 2.46:1, the most any backing in this palette offers a green
          // logo. It stays legible because it is a shape at 12px with
          // an ink-outlined pill around it rather than body text, but
          // do not push it smaller, and do not put it back on a green.
          <span className="mb-2 inline-flex items-center rounded-full border-2 border-(--lp2-ink) bg-white px-2.5 py-1">
            <MayaLockup variant="bare" height={12} className="w-[33px]" />
          </span>
        )}
        <p className="leading-snug">{text}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════ Overview strip ══════════════════════ */

export function MayaOverview() {
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
              <p className="mt-2 flex-1 text-lg leading-relaxed text-(--lp2-ink-soft)">
                {o.body}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-(--lp2-ink) group-hover:text-(--lp2-maya-deep)">
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

/* ═══════════════════════════ Maya section ════════════════════════ */

const MAYA_PROOF = [
  { icon: FileText, text: 'Reads your catalogue, policies and FAQs once — not the open internet' },
  { icon: Sparkles, text: 'Test any change in the playground before a customer ever sees it' },
  { icon: UserRound, text: "Hands off to a human the moment she isn't confident" },
  { icon: Clock, text: 'Waits a beat for a burst of messages, then answers once — not once per message' },
];

export function MayaAssistant() {
  return (
    <section id="maya" className="scroll-mt-24 bg-(--lp2-maya-soft)/40 py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="lp2-display text-3xl leading-[1.1] font-extrabold text-balance sm:text-[2.5rem]">
            The one who actually{' '}
            <Highlight color="maya">understands</Highlight> the question.
          </h2>
          <p className="mt-5 text-xl leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-2xl">
            Retrieval-augmented, not scripted — Maya searches your own
            knowledge base for the closest real answer, then writes a reply
            in context. Ask her the same thing five different ways; she holds
            up all five times.
          </p>

          <ul className="mt-7 space-y-3.5">
            {MAYA_PROOF.map((p) => (
              <li key={p.text} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-(--lp2-maya-soft)">
                  <p.icon className="size-3.5 text-(--lp2-maya-deep)" strokeWidth={2.75} />
                </span>
                <span className="text-sm leading-relaxed font-medium sm:text-base">{p.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <MayaChatCard />
      </div>
    </section>
  );
}

function MayaChatCard() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-2xl border-2 border-(--lp2-ink) bg-white p-5 shadow-(--lp2-shadow-lg)">
        <div className="flex items-center gap-3">
          {/* Her own mark, not a generic bot glyph — the same lockup
              the hero uses, at name size. */}
          <MayaLockup variant="bare" height={26} />
          <p className="flex items-center gap-1.5 text-base font-bold text-(--lp2-ink-soft)">
            <span className="size-2 rounded-full bg-(--lp2-maya)" />
            Trained on 12 documents
          </p>
        </div>

        <div className="mt-4 space-y-2.5">
          <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-(--lp2-cream) px-3.5 py-2.5 text-[13px] font-medium">
            Do you ship the blue one to Kochi, and is COD available?
          </div>
          <div className="w-fit max-w-[90%] rounded-2xl rounded-bl-md border-2 border-(--lp2-ink) bg-(--lp2-mint) px-3.5 py-2.5 text-[13px] font-medium shadow-[2px_2px_0_var(--lp2-ink)]">
            <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-(--lp2-lime) px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase">
              <Sparkles className="size-2.5" strokeWidth={3} /> Maya
            </span>
            <p className="leading-snug">
              Yes to both — blue ships to Kochi in 3–4 days, and Cash on
              Delivery is available on that pincode. Want me to start the order?
            </p>
          </div>
        </div>

        <p className="mt-3 text-center text-base font-bold text-(--lp2-ink-soft)">
          Answered from your shipping policy · 3 seconds
        </p>
      </div>
      <Sparkle color="lime" className="absolute -top-5 -right-4 size-7" />
      <Squiggle color="sky" className="absolute -bottom-4 -left-6 hidden w-14 rotate-12 lg:block" />
    </div>
  );
}

/* ═══════════════════════════ Flows section ═══════════════════════ */

export function MayaFlows() {
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
            <FlowChip icon={GitBranch} hue="maya" label="If/else" title="Slot still open?" small />
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
  icon: typeof Sparkles;
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

export function MayaAutomations() {
  return (
    <section id="automations" className="scroll-mt-24 bg-(--lp2-tangerine-soft)/40 py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <RuleList />

        <div className="lg:order-first">
          <h2 className="lp2-display text-3xl leading-[1.1] font-extrabold text-balance sm:text-[2.5rem]">
            One rule, no canvas.{' '}
            <Highlight color="tangerine">Instant.</Highlight>
          </h2>
          <p className="mt-5 text-xl leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-2xl">
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
    icon: Sparkles,
    hue: 'maya',
    when: 'A customer could ask literally anything',
    use: 'Maya',
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

export function MayaChooser() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHead
          hue="lemon"
          title="You don't have to pick just one."
          highlight="just one"
          subtitle="Most accounts run all three side by side — Maya handles the open-ended stuff, a Flow owns your lead-capture journey, and a couple of Automations quietly tag and route everything else."
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
              <p className="mt-4 text-lg leading-relaxed font-medium text-(--lp2-ink-soft)">
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
export function AskMayaTeaserLink() {
  return (
    <Link
      href="/ask-maya"
      className="inline-flex items-center gap-1 text-sm font-bold text-(--lp2-ink) hover:text-(--lp2-maya-deep)"
    >
      See all three, side by side
      <ArrowRight className="size-3.5" strokeWidth={2.75} />
    </Link>
  );
}
