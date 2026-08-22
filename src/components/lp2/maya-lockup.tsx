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
  priority = false,
  alt,
  className,
}: {
  variant?: keyof typeof LOCKUPS;
  /** Set on the hero mark so it is not queued behind lazier images. */
  priority?: boolean;
  /**
   * Overrides the default alt text. Pass `""` where a visible label
   * already names the mark — repeating it would make a screen reader
   * say the name twice. Anywhere the lockup stands alone, leave this
   * unset so it keeps its real alt.
   */
  alt?: string;
  /**
   * Size the mark here, with HEIGHT utilities only — `h-[13px]`,
   * `h-[92px] sm:h-[124px]`. Width is `auto` below and follows the
   * ratio; adding a width utility pins both dimensions and stretches
   * the artwork.
   */
  className?: string;
}) {
  const { src, width: iw, height: ih } = LOCKUPS[variant];

  // The width/height ATTRIBUTES are the file's intrinsic size, and the
  // rendered size is CSS. Both attributes have to be the real numbers:
  // they exist to hand the browser the true aspect ratio so it reserves
  // the right box before the bytes land.
  //
  // Passing a computed pair instead — `Math.round(h * iw / ih)` against
  // the rendered height — is what the first version did, and it warned
  // on every render. The ratio of two rounded integers is not quite the
  // ratio of the original (36/13 = 2.769 against 1351/493 = 2.741), so
  // the height the browser computed from `h-auto` missed the declared
  // height by a fraction of a pixel. Next compares each rendered
  // dimension against its attribute and warns when exactly one differs
  // — precisely that case. With true intrinsics and both dimensions
  // resolved by CSS, both differ, and Next reads it as the deliberate
  // resize it is.
  return (
    <Image
      src={src}
      // The lockup spells the assistant's name, so it is a name in
      // image form — not decoration. Anything printing "Maya" in text
      // beside it should stop doing that, or pass alt="" so the name is
      // not announced twice.
      alt={alt ?? (variant === 'ask' ? 'ask maya' : 'maya')}
      width={iw}
      height={ih}
      priority={priority}
      className={cn('w-auto', className)}
    />
  );
}
