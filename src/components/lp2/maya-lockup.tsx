import Image from 'next/image';

import { cn } from '@/lib/utils';

// ============================================================
// The Maya wordmark, as it appears on the public /ask-maya page.
//
// Two cuts of the same lockup ship in public/brand: `ask-maya` carries
// the "ask" prefix and is the page's masthead; `maya` is the bare name
// for running text and small marks. Both end in the same chartreuse
// sparkle cluster, which is what ties them to `--lp2-lime`.
//
// Bundled under public/ rather than served from media.instant.nebkern.com
// like the company lockup in src/lib/brand.ts. That host is allow-listed
// in next.config.ts for the corporate marks; these two are feature
// artwork that only this page uses, so a local asset saves a DNS lookup
// and a round trip on the one render that needs them. If Maya's mark
// ever starts appearing across the app, move it to the media host and
// match brand.ts instead.
// ============================================================

const LOCKUPS = {
  /** "ask maya" — the full masthead. Intrinsic 1697 × 493. */
  ask: { src: '/brand/ask-maya.webp', width: 1697, height: 493 },
  /** "maya" alone. Intrinsic 1351 × 493. */
  bare: { src: '/brand/maya.webp', width: 1351, height: 493 },
} as const;

export function MayaLockup({
  variant = 'ask',
  height,
  priority = false,
  alt,
  className,
}: {
  variant?: keyof typeof LOCKUPS;
  /**
   * Rendered height in px at the smallest breakpoint; width follows the
   * intrinsic ratio.
   *
   * To grow the mark responsively pass a WIDTH utility in `className`
   * (`sm:w-[427px]`), never a height one. Height is the dimension the
   * intrinsic `width`/`height` attributes below are pinned against —
   * overriding it in CSS while the width attribute stays put stretches
   * the lockup. Width utilities are safe because `h-auto` lets height
   * track them.
   */
  height: number;
  /** Set on the hero mark so it is not queued behind lazier images. */
  priority?: boolean;
  /**
   * Overrides the default alt text. Pass `""` where a visible label
   * already names the mark — repeating it would make a screen reader
   * say the name twice. Anywhere the lockup stands alone, leave this
   * unset so it keeps its real alt.
   */
  alt?: string;
  className?: string;
}) {
  const { src, width: iw, height: ih } = LOCKUPS[variant];

  // Width is computed from the intrinsic ratio and passed explicitly
  // rather than left to `w-auto`, for the reason src/lib/brand.ts
  // documents at length: a resolved `auto` width lands a pixel off the
  // declared one and Next warns that a single dimension was modified.
  return (
    <Image
      src={src}
      // The lockup spells the assistant's name, so it is a name in
      // image form — not decoration. Anything printing "Maya" in text
      // beside it should stop doing that, or pass alt="" so the name is
      // not announced twice.
      alt={alt ?? (variant === 'ask' ? 'ask maya' : 'maya')}
      width={Math.round(height * (iw / ih))}
      height={height}
      priority={priority}
      className={cn('h-auto', className)}
    />
  );
}
