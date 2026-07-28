import type { CSSProperties } from 'react';
import { ArrowRight, Bot, Check, FileText, MessageCircle, Sparkles } from 'lucide-react';

import { Highlight, Sparkle, Squiggle } from './decor';
import { Btn } from './ui';
import { AutopilotTeaserLink } from './autopilot';

// ============================================================
// AI agents spotlight.
//
// Split layout, and unusually the visual leads on desktop (`lg:order`
// flips it left): the argument here is "it learns your business", and
// the diagram of three documents feeding one agent makes that point
// before the paragraph does.
//
// Flat treatment: white section, graphics carried by fill + faint
// hairlines rather than ink outlines, and gentler corners.
// ============================================================

const PROOF = [
  'Trained on your own docs, FAQs and policies — not the open internet',
  'Test every change in the playground before a customer ever sees it',
  'Hands off to a human the moment the question needs one',
  'Every AI reply sits in the shared inbox. Never a black box.',
];

// The knowledge sources feeding the agent. Ordinary business documents
// on purpose — the promise is "upload what you already have".
const SOURCES = [
  { label: 'Catalogue.pdf', hue: 'coral', icon: FileText },
  { label: 'Shipping policy', hue: 'sky', icon: FileText },
  { label: 'Top 40 FAQs', hue: 'lemon', icon: MessageCircle },
] as const;

export function Lp2AiAgents() {
  return (
    <section
      id="ai-agents"
      className="scroll-mt-28 bg-(--lp2-lemon-soft) py-20 sm:py-28"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <KnowledgeDiagram />

        <div className="lg:order-first">
          <span className="inline-flex items-center gap-2 rounded-full bg-(--lp2-grape) px-3.5 py-1.5 text-xs font-extrabold tracking-wide text-white uppercase">
            <Bot className="size-3.5" strokeWidth={3} />
            AI agents
          </span>

          <h2 className="lp2-display mt-5 text-3xl leading-[1.08] font-extrabold text-balance sm:text-[2.75rem]">
            It reads your catalogue once, then answers{' '}
            <Highlight color="grape">forever</Highlight>.
          </h2>

          <p className="mt-5 text-base leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-lg">
            Upload what you already have. Your agent replies in seconds at
            2am, writes lead details straight into the CRM, and knows
            exactly when to fetch a human.
          </p>

          <ul className="mt-7 space-y-3">
            {PROOF.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-(--lp2-pop)">
                  <Check className="size-3.5" strokeWidth={4} />
                </span>
                <span className="text-sm leading-relaxed font-medium sm:text-base">
                  {p}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Btn href="/signup">
              Meet your agent
              <ArrowRight className="size-5" strokeWidth={2.75} />
            </Btn>
            <AutopilotTeaserLink />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── The diagram ─────────────────────────────────────────────────── */

function KnowledgeDiagram() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      {/* Sources */}
      <div className="space-y-2.5">
        {SOURCES.map((s, i) => (
          <div
            key={s.label}
            className="flex items-center gap-3 rounded-xl border-2 border-(--lp2-ink) bg-white px-4 py-3"
            // Each row nudged a little further right, so the three read
            // as a funnel narrowing toward the agent below them.
            style={{ marginLeft: `${i * 1.25}rem` } as CSSProperties}
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `var(--lp2-${s.hue})` }}
            >
              <s.icon className="size-4" strokeWidth={3} />
            </span>
            <span className="text-sm font-bold">{s.label}</span>
            <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-(--lp2-pop)">
              <Check className="size-3" strokeWidth={4} />
            </span>
          </div>
        ))}
      </div>

      {/* Funnel arrow */}
      <div aria-hidden className="flex justify-center py-3">
        <svg viewBox="0 0 24 44" className="h-11 w-6">
          <path
            d="M12 2v30"
            fill="none"
            stroke="var(--lp2-ink)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="5 6"
          />
          <path
            d="m4 30 8 10 8-10"
            fill="none"
            stroke="var(--lp2-ink)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* The agent */}
      <div className="relative rounded-2xl border-2 border-(--lp2-ink) bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-(--lp2-grape)">
            <Bot className="size-6 text-white" strokeWidth={2.75} />
          </span>
          <div>
            <p className="lp2-display text-lg font-extrabold">Nova&apos;s agent</p>
            <p className="flex items-center gap-1.5 text-xs font-bold text-(--lp2-ink-soft)">
              <span className="size-2 rounded-full bg-(--lp2-grass)" />
              Trained · answering now
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl rounded-bl-md bg-(--lp2-mint) px-4 py-3">
          <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-(--lp2-lemon) px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase">
            <Sparkles className="size-2.5" strokeWidth={3} />
            AI
          </span>
          <p className="text-sm leading-snug font-medium">
            The linen shirt comes in 4 colours, ships free above ₹999, and
            you have 30 days to return it. Want the size chart?
          </p>
        </div>

        <p className="mt-3 text-center text-xs font-bold text-(--lp2-ink-soft)">
          Answered in 4 seconds · no human woken up
        </p>
      </div>

      <Sparkle color="coral" className="absolute -bottom-6 left-6 size-6" />
      <Squiggle color="sky" className="absolute -top-4 -left-6 hidden w-14 -rotate-12 lg:block" />
    </div>
  );
}
