import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { hardShadowButton } from '@/components/lp2/ui';
import { Magnetic } from '@/components/ui/magnetic-button';
import { cn } from '@/lib/utils';
import { waType } from './ui';

// ============================================================
// The page's closing call to action.
//
// Lifted out of landing.tsx once the comparison pages wanted the same
// one. Shared rather than forked on purpose: it is the last thing a
// reader sees on several pages, and two copies drift.
//
// The section wrapper is inlined rather than imported from landing.tsx
// (`Section` is local to that file) — it is one line, and importing it
// would drag the whole landing module, blog fetch and all, into every
// page that only wants this block.
// ============================================================

export function WaClosingCta() {
  return (
    <section className="scroll-mt-24 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-[900px] text-center">
        {/* "typing" and the dots in the voltage green. The spec reserves
            that green for the primary CTA, so this is a deliberate
            exception — the word is the page's closing image, not a
            control. Dots are aria-hidden: the sentence already says it. */}
        <h2 className={cn(waType.displayXl, 'text-balance')}>
          Your customers are already{' '}
          <span className="text-(--wa-green)">typing</span>
          <span aria-hidden className="wa-typing">
            <span />
            <span />
            <span />
          </span>
        </h2>
        <p
          className={cn(
            waType.bodyLg,
            'mx-auto mt-7 max-w-[560px] text-pretty text-(--wa-ink-muted)',
          )}
        >
          Set up in an afternoon, free for 14 days, no card required. Worst case
          you learn what your customers have been asking all along.
        </p>
        {/* gap-5: each button throws a 4px shadow on hover and, now that
            it is magnetic, can lean up to 14px toward the cursor. Only
            the hovered one moves — the field is its own wrapper — so 20px
            is enough to keep the leaning button clear of its neighbour. */}
        <div className="mt-10 flex flex-col items-center justify-center gap-5 sm:flex-row">
          <Magnetic>
            <Link href="/signup" className={hardShadowButton}>
              Start free trial
              <ArrowRight className="size-4" strokeWidth={2.5} />
            </Link>
          </Magnetic>
          <Magnetic>
            <Link href="/login" className={hardShadowButton}>
              Log in
            </Link>
          </Magnetic>
        </div>
      </div>
    </section>
  );
}
