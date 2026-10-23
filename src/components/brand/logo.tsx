import Image from 'next/image';

import { LOGO_URL } from '@/lib/brand';
import { cn } from '@/lib/utils';

/**
 * The brand logo — the "dripo" wordmark, one asset. See `lib/brand.ts`
 * for where the file lives.
 */
const LOGO_SRC = LOGO_URL;

/** The asset's true pixel size. `next/image` needs the real ratio to
 *  reserve the right box before the bytes land — get this wrong and the
 *  header jumps on first paint. Every caller then sizes by height and
 *  lets the width follow. */
const INTRINSIC_WIDTH = 712;
const INTRINSIC_HEIGHT = 240;

export function BrandLogo({
  className,
  priority = false,
}: {
  /** Set the height here (`h-8`, `h-9`, …) — width is always `auto`. */
  className?: string;
  /** Pass on the marketing nav and anywhere else the lockup is above
   *  the fold, so it is not queued behind lazier images. */
  priority?: boolean;
}) {
  return (
    <Image
      src={LOGO_SRC}
      // The wordmark reads "dripo", so this is the brand name in
      // image form — not decoration. Callers that already print
      // "Dripo" beside it should not be doing that any more.
      alt="Dripo WhatsApp for Business"
      width={INTRINSIC_WIDTH}
      height={INTRINSIC_HEIGHT}
      // Drawn about 100px wide (h-8 / h-9). Without `sizes`, next/image
      // offers only 1x/2x candidates of the intrinsic width — with the
      // old 3514px lockup the nav downloaded a 3840px image, Lighthouse's
      // "properly size images" failure.
      sizes="240px"
      priority={priority}
      className={cn('w-auto', className)}
    />
  );
}
