import Link from 'next/link';

import { cn } from '@/lib/utils';

// ============================================================
// Primitives for the WhatsApp design (whatsapp.design.md).
//
// Only used under `.lp2[data-design="whatsapp"]`, which defines the
// `--wa-*` colours these read (see app/(marketing)/whatsapp.css).
// ============================================================

/**
 * The spec's two buttons.
 *
 * `primary` is the voltage-green pill — ink text, 1px ink hairline,
 * 53px tall. The spec allows it only on the page's primary action, so
 * the landing page uses it exactly four times (nav, hero, the black
 * band, the closing CTA). Everything else is `secondary`: transparent
 * with a hairline, 44px.
 *
 * `onDark` flips the secondary pill for the black band.
 */
export function WaPill({
  href,
  children,
  variant = 'secondary',
  onDark = false,
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  onDark?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full border text-base leading-none transition-colors',
        variant === 'primary'
          ? 'h-[53px] border-(--wa-ink) bg-(--wa-green) px-7 text-(--wa-ink) hover:bg-(--wa-green-hover)'
          : onDark
            ? 'h-11 border-white px-6 text-white hover:bg-white hover:text-black'
            : 'h-11 border-(--wa-ink) px-6 text-(--wa-ink) hover:bg-(--wa-ink) hover:text-(--wa-canvas)',
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* Type scale from the spec, all at weight 400. Sizes clamp down on small
   screens: an 80px headline does not fit a 360px phone. */
export const waType = {
  displayXl: 'text-[clamp(2.75rem,7.2vw,5rem)] leading-[1] tracking-[-0.02em]',
  displayLg: 'text-[clamp(2.25rem,5.4vw,3.75rem)] leading-[1.02] tracking-[-0.015em]',
  displayMd: 'text-[clamp(1.875rem,4.2vw,3rem)] leading-[1.06] tracking-[-0.01em]',
  bodyLg: 'text-[18px] leading-[25px]',
  bodyMd: 'text-[16px] leading-[22px]',
  caption: 'text-[12px] leading-[15.6px]',
} as const;
