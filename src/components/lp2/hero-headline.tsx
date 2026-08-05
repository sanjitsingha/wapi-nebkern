'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import { Highlight } from './decor';

// ============================================================
// The hero's two-line headline, with the highlighted phrases on a
// rotation.
//
// Only the boxed words change. "Turn" and "into" are fixed, so every
// pair has to read as a whole sentence on its own — the frame is
// "Turn <lead> into <close>", and a phrase that only works on one line
// breaks the other half of the sentence.
//
// Both lines swap together from a single index. Rotating them
// independently would produce combinations nobody wrote, and most of
// those don't mean anything ("Turn cold leads into morning sales").
//
// This is the one client component in the hero; everything around it
// stays server-rendered. The first pair is what the server sends, so
// crawlers, no-JS visitors and the LCP measurement all see the real
// headline rather than an empty box waiting for hydration.
// ============================================================

/** How long each pair holds before the next takes over. */
const ROTATE_MS = 30_000;

/** Crossfade length. Kept in step with `duration-300` on the lines. */
const FADE_MS = 300;

// Width matters more than it looks here. `Highlight` is
// `whitespace-nowrap`, so each line has to fit its column unbroken at
// every breakpoint, and the hero's font sizes are tuned to the longest
// line — "Turn WhatsApp chats", 10.37em in DM Sans at weight 800 with
// this tracking. Every phrase below was measured against that budget.
// Adding a longer one doesn't overflow; it silently wraps to three
// lines on a phone. Measure first (see hero.tsx for where the number
// comes from), or keep new phrases under roughly 15 characters.
const PHRASES = [
  { lead: 'WhatsApp chats', close: 'paid orders' }, // 10.37em / 7.51em
  { lead: 'Instagram DMs', close: 'repeat buyers' }, //  9.50em / 8.80em
  { lead: 'late-night pings', close: 'morning sales' }, // 10.03em / 8.68em
  { lead: 'cold leads', close: 'loyal customers' }, //  7.23em / 9.68em
] as const;

export function RotatingHeadline() {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    // Reduced motion means no rotation at all, not a faster or gentler
    // one. Text that rewrites itself under the reader is the thing
    // being opted out of; fading it more politely doesn't help.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let swap: ReturnType<typeof setTimeout> | undefined;

    const tick = setInterval(() => {
      // Fade out, change the words while nothing is visible, fade the
      // new pair back in. The swap has to happen at zero opacity
      // because the line is centred and the phrases are different
      // widths — going from "cold leads" to "WhatsApp chats" moves the
      // word "Turn" by about 125px at desktop size, and that jump is
      // only invisible if it happens in the dark.
      setShown(false);
      swap = setTimeout(() => {
        setIndex((n) => (n + 1) % PHRASES.length);
        setShown(true);
      }, FADE_MS);
    }, ROTATE_MS);

    return () => {
      clearInterval(tick);
      clearTimeout(swap);
    };
  }, []);

  const phrase = PHRASES[index];
  const line = cn(
    'block transition-opacity duration-300 ease-out',
    shown ? 'opacity-100' : 'opacity-0',
  );

  return (
    <>
      <span className={line}>
        Turn <Highlight color="mint">{phrase.lead}</Highlight>
      </span>
      <span className={cn(line, 'mt-2 sm:mt-3')}>
        into <Highlight color="mint">{phrase.close}</Highlight>
      </span>
    </>
  );
}
