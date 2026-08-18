import Image from 'next/image';

import { cn } from '@/lib/utils';

/**
 * The brand lockup — pin mark plus the "instant" wordmark, one asset.
 *
 * Served from the media host rather than bundled: it is already listed
 * in `next.config.ts`'s `images.remotePatterns` (`/assets/**`), which is
 * where the Meta and MSME lockups in the footer come from too. Keeping
 * every brand asset on the same origin means a re-cut logo is a file
 * swap, not a deploy.
 */
const LOGO_SRC =
  'https://media.instant.nebkern.com/assets/instant-full-logo-green.webp';

/** The asset's true pixel size. `next/image` needs the real ratio to
 *  reserve the right box before the bytes land — get this wrong and the
 *  header jumps on first paint. Every caller then sizes by height and
 *  lets the width follow. */
const INTRINSIC_WIDTH = 3514;
const INTRINSIC_HEIGHT = 844;

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
      // The wordmark reads "instant", so this is the brand name in
      // image form — not decoration. Callers that already print
      // "Instant" beside it should not be doing that any more.
      alt="Instant"
      width={INTRINSIC_WIDTH}
      height={INTRINSIC_HEIGHT}
      priority={priority}
      className={cn('w-auto', className)}
    />
  );
}
