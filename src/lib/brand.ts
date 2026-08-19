// The full company wordmark — the green pin mark plus "instant".
//
// Lives on the brand-artwork prefix that next.config.ts allow-lists for
// next/image, so it goes through the optimiser rather than shipping the
// 3514×844 original. Transparent alpha and green throughout, so one
// file serves light and dark backgrounds alike.
//
export const LOGO_URL =
  'https://media.instant.nebkern.com/assets/instant-full-logo-green.webp';

/** Intrinsic 3514 × 844. */
const LOGO_RATIO = 3514 / 844;

/**
 * Width to pair with a rendered `height`, for next/image's width/height
 * props.
 *
 * Size the logo with THESE rather than with `h-8 w-auto` classes. The
 * optimiser's resized variants don't preserve the ratio exactly — a
 * 384px-wide render is 384×92 (4.1739) against the original's 4.1635 —
 * so `width: auto` resolves a pixel wider than the declared width and
 * Next warns that one dimension was modified without the other. Letting
 * the props do the sizing keeps rendered and declared identical.
 */
export const logoWidthFor = (height: number) =>
  Math.round(height * LOGO_RATIO);
