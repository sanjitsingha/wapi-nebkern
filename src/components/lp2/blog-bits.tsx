import type { Lp2Hue } from './decor';

// ============================================================
// Small pieces shared by the /lp-2 blog index and the read page.
// ============================================================

// Only the hues that have a `-soft` companion in lp2.css, because cover
// panels and tag pills both fill with the pastel and outline with the
// saturated version.
const POST_HUES: Lp2Hue[] = ['lemon', 'coral', 'sky', 'grape', 'tangerine'];

/**
 * Picks a hue from a string, deterministically.
 *
 * Deterministic matters: a post has to keep the same colour between the
 * index card and its own page, and across every rebuild. `Math.random`
 * here would reshuffle the whole grid on each render and make the blog
 * feel broken.
 */
export function postHue(seed: string): Lp2Hue {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);
  return POST_HUES[sum % POST_HUES.length];
}

/** Tag chip. Coloured from the tag itself, so "Guides" is the same
 *  colour everywhere it appears on the site. */
export function TagPill({ tag }: { tag: string }) {
  const hue = postHue(tag);
  return (
    <span
      className="rounded-full border-2 border-(--lp2-ink) px-2.5 py-0.5 text-[11px] font-extrabold"
      style={{ backgroundColor: `var(--lp2-${hue}-soft)` }}
    >
      {tag}
    </span>
  );
}
