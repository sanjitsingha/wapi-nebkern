import type { CSSProperties } from 'react';
import { Plus } from 'lucide-react';

import { SectionHead } from './ui';

// ============================================================
// FAQ.
//
// Built on <details>/<summary>, so it opens with zero JavaScript, is
// keyboard-operable for free, and survives being rendered before
// hydration — worth more on a marketing page than any animation a
// hand-rolled accordion would buy.
//
// Answers are kept in sync with the ones on `/`; they're the questions
// sales actually gets asked.
// ============================================================

const FAQS = [
  {
    hue: 'lemon',
    q: 'Do I need the official WhatsApp Business API?',
    a: 'Yes — wacrm runs on Meta’s official Cloud API, which is what keeps your number safe from bans and your messages compliant. Connecting takes a few clicks through embedded signup, and we walk you through it.',
  },
  {
    hue: 'coral',
    q: 'Can my whole team use one WhatsApp number?',
    a: 'That is exactly what wacrm is for. Everyone works from a shared inbox on the same number, with assignments, internal notes and the full conversation history — no more forwarding screenshots.',
  },
  {
    hue: 'sky',
    q: 'How does the AI agent actually learn my business?',
    a: 'You upload your own knowledge base — product docs, FAQs, policies. It answers routine questions instantly, writes lead details into contact fields, and hands off to a human whenever it should. Test everything in the playground before it goes anywhere near a customer.',
  },
  {
    hue: 'grape',
    q: 'What happens when the free trial ends?',
    a: 'Your 14-day trial includes every feature. When it ends, pick a plan to keep sending — your data, contacts and history stay untouched either way.',
  },
  {
    hue: 'tangerine',
    q: 'Can I send bulk broadcasts?',
    a: 'Yes — build campaigns on Meta-approved templates, target them with tags, lists and segments, and watch delivery and read stats update in real time.',
  },
  {
    hue: 'pop',
    q: 'Does it connect to my other tools?',
    a: 'Zapier, Make and n8n via outbound webhooks (message received, contact created, deal stage changed, and more), plus a REST API for creating contacts or sending messages from any system you already run.',
  },
  {
    hue: 'lemon',
    q: 'Can I bring Instagram and Messenger in too?',
    a: 'Yes — on plans with those channels, Instagram DMs and Messenger threads land in the same shared inbox, so one team covers all three.',
  },
] as const;

export function Lp2Faq() {
  return (
    <section className="bg-(--lp2-grape-soft) py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHead
          eyebrow="Questions"
          hue="pop"
          title="Everything people ask before signing up."
          highlight="before signing up"
        />

        <div className="mt-12 space-y-3">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group rounded-xl border-2 border-(--lp2-ink) bg-white"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-base font-bold [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden
                  className="size-3.5 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(--lp2-${f.hue})` } as CSSProperties}
                />
                <span className="flex-1 text-pretty">{f.q}</span>
                {/* A plus that becomes a minus. `group-open:rotate-45`
                    on a plus glyph is the cheapest possible open/close
                    affordance and needs no second icon. */}
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--lp2-cream) transition-transform duration-200 group-open:rotate-45">
                  <Plus className="size-4" strokeWidth={3} />
                </span>
              </summary>
              <p className="border-t border-(--lp2-ink)/10 px-5 py-4 text-sm leading-relaxed text-(--lp2-ink-soft)">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
