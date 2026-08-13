import Link from 'next/link';
import { CheckCheck, Flame, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { SectionHead, press } from './ui';

// ============================================================
// "10X your performance with Instant AI" — the two agents, shown
// working.
//
// Replaces the old three-step "Live by Thursday" block, which answered
// "how much work is this to set up?". This slot sits after the feature
// and automation sections, where a reader who now believes the product
// works starts asking what it actually changes.
//
// Two cards rather than a list of capabilities, because the two agents
// do genuinely different jobs — one turns a stranger into a qualified
// lead, the other stops routine questions reaching a human at all — and
// a reader is usually shopping for one of them specifically.
//
// Each card argues by demonstration: a real exchange, then the outcome
// underneath it. The conversation markup is the same speech-bubble
// vocabulary the hero used before it was rebuilt around the headline;
// keeping it here means the page still shows a chat somewhere, which is
// the one thing a WhatsApp product should never make you imagine.
// ============================================================

// Each card gets its own wash, strongest along the bottom edge and
// gone by four-fifths of the way up. Mixed from the saturated hue
// rather than using the `-soft` pastel directly: the pastels are close
// enough to each other that two of them side by side read as a printing
// error, and the point here is that these are two different agents.
//
// The top of every card lands on white so the incoming speech bubbles —
// white with an ink outline — keep their contrast where the eye starts.
const wash = (hue: string) =>
  `linear-gradient(to top, color-mix(in oklab, var(--lp2-${hue}) 20%, #fff), #fff 80%)`;

const AGENTS = [
  {
    id: 'lead',
    hue: 'grape',
    stat: '24/7',
    statLabel: 'Qualifying and converting',
    title: 'Lead-qualifying agent',
    body: 'Works out who is serious, scores them, and writes the details straight into your CRM — while the enquiry is still warm.',
    cta: 'Build an agent',
    thread: [
      {
        side: 'in',
        text: "Hi — we're comparing tools for a 12-person team.",
      },
      {
        side: 'out',
        text: 'Happy to help. What matters most — the shared inbox, campaigns, or automations?',
      },
    ],
  },
  {
    id: 'support',
    hue: 'sky',
    stat: '6s',
    statLabel: 'Average first reply',
    title: 'Customer support agent',
    body: 'Answers the questions that fill an inbox — delivery, returns, sizing, hours — and hands over the moment a person is genuinely needed.',
    cta: 'Train your agent',
    thread: [
      {
        side: 'in',
        text: 'Can I change the delivery address on my order?',
      },
      {
        side: 'out',
        text: "Done — it's updated. Anything else before it ships?",
      },
      {
        side: 'in',
        text: "And what's your return policy?",
      },
      {
        side: 'out',
        text: '30 days, unworn, free pickup. Want me to start one?',
      },
    ],
  },
] as const;

export function Lp2AiPerformance() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead
          hue="coral"
          title="10X your performance with Instant AI"
          highlight="10X"
          subtitle="Let Instant AI take the repetitive work off your team, so the hours they do spend on WhatsApp go into the conversations that build relationships — and revenue."
        />

        {/* `mt-20` rather than the usual 14: the stat pills hang above
            each card's top edge and need somewhere to hang into. */}
        <div className="mt-20 grid gap-10 md:grid-cols-2 md:gap-8">
          {AGENTS.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </section>
  );
}

function AgentCard({ agent }: { agent: (typeof AGENTS)[number] }) {
  return (
    <div className="relative">
      {/* The stat straddles the card's top border — half in, half out.
          Centred on the card, not the page, so the two read as a pair
          at any width. */}
      <div className="absolute -top-6 left-1/2 z-10 -translate-x-1/2">
        <span
          className="flex items-center gap-2.5 rounded-full border-2 border-(--lp2-ink) px-4 py-2 text-white shadow-(--lp2-shadow-sm)"
          style={{ backgroundColor: `var(--lp2-${agent.hue})` }}
        >
          <span className="lp2-display text-2xl leading-none font-extrabold">
            {agent.stat}
          </span>
          <span className="max-w-28 text-[11px] leading-tight font-bold">
            {agent.statLabel}
          </span>
        </span>
      </div>

      {/* No ink outline and no offset shadow on the card itself — it
          takes its border from its own gradient hue instead. The
          stuck-on treatment stays on the pieces inside (bubbles, lead
          card, chip), so the card reads as the surface they sit on
          rather than a fourth object competing with them. */}
      <div
        className="flex h-full flex-col rounded-2xl border-2 p-6 pt-12"
        style={{
          backgroundImage: wash(agent.hue),
          borderColor: `var(--lp2-${agent.hue})`,
        }}
      >
        {/* The demo. `flex-1` so both cards' copy blocks line up even
            though one conversation is two bubbles longer than the
            other. */}
        <div className="flex-1 space-y-4">
          {agent.thread.map((m) => (
            <Bubble key={m.text} side={m.side} text={m.text} />
          ))}

          {agent.id === 'lead' && <LeadCard />}
        </div>

        <h3 className="lp2-display mt-7 text-2xl font-extrabold">
          {agent.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-(--lp2-ink-soft)">
          {agent.body}
        </p>

        <Link
          href="/signup"
          className={cn(
            'mt-5 inline-flex h-11 w-fit items-center justify-center gap-2 rounded-xl border-2 border-(--lp2-ink) bg-white px-5 text-sm font-bold shadow-(--lp2-shadow-sm)',
            press,
          )}
        >
          {agent.cta}
        </Link>
      </div>
    </div>
  );
}

function Bubble({ side, text }: { side: 'in' | 'out'; text: string }) {
  const out = side === 'out';
  return (
    <div className={cn('flex', out ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          // The squared-off corner on the speaker's side is what makes
          // a rounded rectangle read as a speech bubble.
          'max-w-[88%] rounded-2xl border-2 border-(--lp2-ink) px-3 py-2 text-[13px] font-medium shadow-[2px_2px_0_var(--lp2-ink)]',
          out ? 'rounded-br-md bg-(--lp2-mint)' : 'rounded-bl-md bg-white',
        )}
      >
        {out && (
          <span className="mb-1.5 inline-flex items-center gap-1 rounded-full border-2 border-(--lp2-ink) bg-(--lp2-lemon) px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase">
            <Sparkles className="size-2.5" strokeWidth={3} />
            AI
          </span>
        )}
        <p className="leading-snug">{text}</p>
      </div>
    </div>
  );
}

/** What the qualifying agent produces: a scored, routed lead record. */
function LeadCard() {
  return (
    <div className="rounded-xl border-2 border-(--lp2-ink) bg-white p-3 shadow-[2px_2px_0_var(--lp2-ink)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-extrabold">
            <Flame className="size-3.5 shrink-0 text-(--lp2-coral)" strokeWidth={3} />
            Priya Raman
          </p>
          <p className="truncate text-[11px] font-semibold text-(--lp2-ink-soft)">
            Novatech · 12 seats
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="lp2-display text-xl leading-none font-extrabold">92</p>
          <p className="text-[10px] font-bold tracking-wide text-(--lp2-ink-soft) uppercase">
            Score
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {['Qualified', 'Buying intent', 'Routed to Sales'].map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-(--lp2-ink)/15 bg-(--lp2-cream) px-2 py-0.5 text-[10px] font-bold"
          >
            {tag}
          </span>
        ))}
      </div>

      <p className="mt-2.5 flex items-center gap-1.5 border-t border-(--lp2-ink)/10 pt-2 text-[11px] font-semibold text-(--lp2-ink-soft)">
        <CheckCheck className="size-3.5 shrink-0 text-(--lp2-grass)" strokeWidth={3} />
        {/* Not "no one woken up" — the agents section directly above
            ends its diagram on "no human woken up", and the two land
            close enough now to read as a verbal tic rather than two
            claims. That line is sharper up there, where it pairs with a
            reply time; this card's point was never the hour, it is that
            a scored, tagged, routed record exists without anyone doing
            data entry. */}
        Written to the CRM · nobody typed it in
      </p>
    </div>
  );
}
