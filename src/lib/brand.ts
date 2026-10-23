// The Dripo wordmark, in brand green.
//
// Bundled under public/ and served through the next/image optimiser.
// Transparent alpha and green throughout, so one file serves light and
// dark backgrounds alike. Alongside it in public/brand:
// dripo-wordmark-white.webp for solid colour grounds, and dripo-wordmark.png
// for the link-preview image (next/og cannot read WebP).
//
export const LOGO_URL = '/brand/dripo-wordmark.webp';

/** Intrinsic 712 × 240. */
const LOGO_RATIO = 712 / 240;

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
