// ============================================================
// Which visual design the public site renders.
//
// Two designs share every public URL:
//
//   whatsapp — built from whatsapp.design.md: warm cream canvas,
//              near-black ink, a single voltage-green pill CTA, weight
//              400 everywhere, pill and tile radii, no shadows. The
//              default, and what every visitor sees.
//   playful  — the lp2 "joyful rebuild": confetti hues, sticker shadows,
//              Manrope at heavy weights. The previous default. Its code
//              is kept, but nothing links to it any more: the on-page
//              switch and the route that set the cookie were removed
//              once the WhatsApp design was chosen. To bring it back,
//              change DEFAULT_SITE_DESIGN.
//
// The layouts still read a `site_design` cookie, so one set of pages can
// serve either design with no duplicated routes. Nothing sets that cookie
// now. Constants only in this file — the server reader lives in
// site-design.server.ts, which pulls in next/headers.
// ============================================================

export const SITE_DESIGN_COOKIE = 'site_design';

export const SITE_DESIGNS = ['playful', 'whatsapp'] as const;

export type SiteDesign = (typeof SITE_DESIGNS)[number];

export const DEFAULT_SITE_DESIGN: SiteDesign = 'whatsapp';

export function isSiteDesign(value: unknown): value is SiteDesign {
  return (
    typeof value === 'string' &&
    (SITE_DESIGNS as readonly string[]).includes(value)
  );
}
