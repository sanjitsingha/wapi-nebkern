import type { CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';

import { AvatarStack, Sparkle, Squiggle, Swash } from './decor';
import { Btn } from './ui';

// ============================================================
// Closing CTA — one loud panel, then the footer.
//
// The panel is mint rather than white so the page ends on colour, and
// it's the only place both buttons appear side by side at full size.
// Everything decorative here is `aria-hidden` and clipped by the
// panel's own `overflow-hidden`.
// ============================================================

// Fixed positions, not random — a random scatter re-rolls on every
// render in dev and makes it impossible to tell whether a tweak
// improved the composition.
const CONFETTI = [
  { top: '12%', left: '8%', hue: 'lemon', size: 'size-6' },
  { top: '68%', left: '5%', hue: 'coral', size: 'size-5' },
  { top: '20%', left: '88%', hue: 'sky', size: 'size-7' },
  { top: '76%', left: '92%', hue: 'grape', size: 'size-5' },
  { top: '84%', left: '30%', hue: 'tangerine', size: 'size-4' },
  { top: '10%', left: '68%', hue: 'pop', size: 'size-4' },
] as const;

export function Lp2Cta() {
  return (
    <section className="bg-white px-4 py-20 sm:px-6 sm:py-28">
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl bg-(--lp2-mint) px-6 py-16 text-center sm:px-12">
        {CONFETTI.map((c, i) => (
          <Sparkle
            key={i}
            color={c.hue}
            className={`lp2-float absolute ${c.size}`}
            style={
              {
                top: c.top,
                left: c.left,
                // Staggered so the six don't bob in unison, which
                // reads as one moving object rather than confetti.
                animationDelay: `${i * -0.9}s`,
              } as CSSProperties
            }
          />
        ))}
        <Squiggle
          color="coral"
          className="absolute top-8 left-1/2 hidden w-20 -translate-x-1/2 sm:block"
        />

        <div className="relative">
          <h2 className="lp2-display text-3xl leading-[1.06] font-extrabold text-balance sm:text-5xl">
            Your customers are already typing.{' '}
            <Swash color="lemon">Go say hi.</Swash>
          </h2>

          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-lg">
            Set up in an afternoon, free for 14 days, no card required. Worst
            case you learn what your customers have been asking all along.
          </p>

          <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Btn href="/signup">
              Start free trial
              <ArrowRight className="size-5" strokeWidth={2.75} />
            </Btn>
            <Btn href="/login" variant="plain">
              Log in
            </Btn>
          </div>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <AvatarStack />
            <p className="text-sm font-bold text-(--lp2-ink-soft)">
              Join 2,000+ teams already on WhatsApp
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
