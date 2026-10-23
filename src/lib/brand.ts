// The full company wordmark — the green pin mark plus "dripo".
//
// Bundled under public/ and served through the next/image optimiser
// rather than shipping the 2931×844 original. Transparent alpha and
// green throughout, so one file serves light and dark backgrounds alike.
//
// An interim cut: the old lockup's pin mark with "dripo" set in Manrope
// 600, made when the product was renamed from Instant. Replace the file
// (and the ratio below) when the designed logo arrives.
//
export const LOGO_URL = '/brand/dripo-logo.webp';

/** Intrinsic 2931 × 844. */
const LOGO_RATIO = 2931 / 844;

/**
 * Width to pair with a rendered `height`, for next/image's width/height
 * props.
 *
 * Size the logo with THESE rather than with `h-8 w-auto` classes. The
 * optimiser's resized variants round each side to whole pixels, so a
 * small render's ratio drifts from the original's, `width: auto`
 * resolves a pixel off the declared width, and Next warns that one
 * dimension was modified without the other. Letting
 * the props do the sizing keeps rendered and declared identical.
 */
export const logoWidthFor = (height: number) =>
  Math.round(height * LOGO_RATIO);
