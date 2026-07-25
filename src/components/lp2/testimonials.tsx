import { Star } from 'lucide-react';

import { Squiggle } from './decor';
import { SectionHead } from './ui';

// ============================================================
// Testimonials — three quote cards.
//
// Placeholder copy: these are written to the shape a real quote takes
// (a specific number, a named job, a sentence of voice) so the layout
// is honest about how much room the real ones need. Swap the text and
// the names when actual customer quotes exist; nothing else changes.
//
// Flat treatment: white section, faint hairline cards, gentler corners.
// ============================================================

const QUOTES = [
  {
    quote:
      'We were losing orders overnight. The agent now answers every 2am "is this in stock?" and I wake up to confirmed sales instead of missed calls.',
    name: 'Aarti Rao',
    role: 'Owner, Nova Store',
    hue: 'lemon',
    initials: 'AR',
  },
  {
    quote:
      'Four of us share one number now. No more "did anyone reply to her?" in the group chat at 9pm.',
    name: 'Mohit Kapoor',
    role: 'Head of Sales, Urban Threads',
    hue: 'sky',
    initials: 'MK',
  },
  {
    quote:
      'Campaign to 6,000 contacts, 41% replied. Our email list has never done anything close to that.',
    name: 'Sara Pinto',
    role: 'Marketing, Belle Salon',
    hue: 'coral',
    initials: 'SP',
  },
] as const;

export function Lp2Testimonials() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead
          eyebrow="Happy humans"
          hue="tangerine"
          title="The kind of messages we like getting."
          highlight="we like getting"
        />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {QUOTES.map((q) => (
            <figure
              key={q.name}
              className="flex h-full flex-col rounded-xl border-2 border-(--lp2-ink) bg-white p-6 transition-transform duration-200 hover:-translate-y-1"
            >
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="size-4 fill-(--lp2-lemon) text-(--lp2-ink)"
                    strokeWidth={1.5}
                  />
                ))}
              </div>

              <blockquote className="mt-4 flex-1 text-base leading-relaxed font-medium text-pretty">
                &ldquo;{q.quote}&rdquo;
              </blockquote>

              <figcaption className="mt-6 flex items-center gap-3 border-t border-(--lp2-ink)/10 pt-4">
                <span
                  className="flex size-11 items-center justify-center rounded-full text-xs font-extrabold"
                  style={{ backgroundColor: `var(--lp2-${q.hue})` }}
                >
                  {q.initials}
                </span>
                <span>
                  <span className="block text-sm font-extrabold">{q.name}</span>
                  <span className="block text-xs font-semibold text-(--lp2-ink-soft)">
                    {q.role}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>

        <Squiggle color="pop" className="mx-auto mt-12 hidden w-24 sm:block" />
      </div>
    </section>
  );
}
