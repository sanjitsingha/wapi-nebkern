import Image from 'next/image';
import Link from 'next/link';

import type { Lp2Hue } from './decor';
import { LEGAL_LINKS } from './legal-links';

const META_LOGO = 'https://media.instant.nebkern.com/assets/meta-logo.png';

const MSME_LOGO = 'https://media.instant.nebkern.com/assets/msme-logo.png';

/** As issued. Displayed verbatim — it is a registration identifier, so
 *  it should be checkable against the Udyam portal character for
 *  character. */
const UDYAM_NUMBER = 'UDYAM-WB-06-0069607';

// ============================================================
// Footer. Ink panel, so the page closes the way the social-proof strip
// opened it — the two dark bands bookend all the cream in between.
// ============================================================

// The in-page anchors are absolute (`/#features`) rather than bare
// hashes, because this footer also renders on the legal and blog pages —
// a bare `#features` there scrolls to nothing.
const COLUMNS: {
  title: string;
  hue: Lp2Hue;
  links: { label: string; href: string }[];
}[] = [
  {
    title: 'Product',
    hue: 'lemon',
    links: [
      // The same five the Features menu offers. A footer that says only
      // "Features" hands a crawler one link into a section anchor; these
      // are five real pages, and this is the site-wide link to each.
      { label: 'Shared inbox', href: '/features/shared-inbox' },
      { label: 'Campaigns', href: '/features/campaigns' },
      { label: 'Segments & lists', href: '/features/segments' },
      { label: 'Pipelines', href: '/features/pipelines' },
      { label: 'Ask Maya', href: '/ask-maya' },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  {
    title: 'Resources',
    hue: 'sky',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Blog', href: '/blog' },
      // The only site-wide link to /newsletter — without it the page was
      // in the sitemap but reachable from nowhere on the site.
      { label: 'Newsletter', href: '/newsletter' },
      { label: 'Contact us', href: '/contact' },
    ],
  },
  {
    title: 'Account',
    hue: 'coral',
    links: [
      { label: 'Log in', href: '/login' },
      { label: 'Sign up', href: '/signup' },
    ],
  },
];

// The policies get their own band below the columns rather than a fourth
// column of their own: there are eleven, and a column that long would
// tower over its neighbours. The list itself lives in `legal-links.ts`,
// shared with the sidebar on the legal pages so the two cannot drift.

export function Lp2Footer() {
  return (
    <footer className="bg-white text-(--lp2-ink)">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        {/* Three link columns and the Product Hunt badge. The brand
            blurb that used to take the first two columns is gone — see
            the note in the bottom bar for where its one load-bearing
            sentence went. */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="flex items-center gap-2 text-sm font-extrabold">
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: `var(--lp2-${col.hue})` }}
                />
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm font-medium text-(--lp2-ink-soft) transition-colors hover:text-(--lp2-ink)"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Product Hunt badge. A plain <img>, not next/image: the badge
              is a remote SVG, and routing it through the optimiser would
              mean adding producthunt.com to remotePatterns AND turning on
              dangerouslyAllowSVG for the whole app — a lot of surface for
              one 250x54 image that is already tiny and vector.

              `rel` is ours, not theirs: their snippet opens a new tab with
              no `noopener`, which hands the opened page a handle on this
              one. */}
          <div className="flex items-start lg:justify-end">
            <a
              href="https://www.producthunt.com/products/instant-whatsapp-automation-platform/reviews/new?utm_source=badge-product_review&utm_medium=badge&utm_source=badge-instant-whatsapp-automation-platform"
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://api.producthunt.com/widgets/embed-image/v1/product_review.svg?product_id=1319157&theme=light"
                alt="Instant — WhatsApp Automation Platform on Product Hunt"
                width={250}
                height={54}
                className="h-[54px] w-[250px]"
              />
            </a>
          </div>
        </div>

        {/* Legal band. Its own row so all eleven policies fit without one
            column running three times the height of its neighbours. */}
        <div className="mt-12 border-t border-(--lp2-ink)/15 pt-8">
          <p className="flex items-center gap-2 text-sm font-extrabold">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ backgroundColor: 'var(--lp2-grape)' }}
            />
            Legal &amp; policies
          </p>
          <ul className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-sm font-medium text-(--lp2-ink-soft) transition-colors hover:text-(--lp2-ink)"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Credentials. Both lockups are near-black artwork, so on this
            white panel they need no light surface of their own — the
            chips are kept for grouping, and take the hairline the rest
            of the design uses, since white on white has no edge.

            `items-stretch` so the two chips match heights: the MSME
            lockup is a stacked three-line mark and sets the taller of
            the two, and hard-coding a height on both would need
            revisiting every time either logo or its label changed. */}
        <div className="mt-10 flex flex-wrap items-stretch gap-3 border-t border-(--lp2-ink)/15 pt-8">
          <span className="flex items-center gap-2.5 rounded-xl border border-(--lp2-ink)/15 bg-white px-4 py-2.5 text-(--lp2-ink)">
            {/* `alt=""` — the words beside it already say Meta, so a
                name here makes a screen reader read the brand twice. */}
            {/* Intrinsic 4096 × 825, not the rendered 79 × 16. The
                attributes are only here to give the browser the true
                ratio; `h-4 w-auto` is what sizes it. Declaring the
                rendered pair instead rounds the ratio to 79/16 — off
                the real 4.9648 by enough that the width `w-auto`
                computes lands a fraction from the attribute, which is
                exactly what Next's "width or height modified" warning
                fires on. */}
            <Image
              src={META_LOGO}
              alt=""
              width={4096}
              height={825}
              // Drawn about 80px wide. Without `sizes`, next/image offers
              // only 1x/2x candidates of the 4096px intrinsic width, so
              // every visitor downloaded a ~3840px PNG for this badge.
              sizes="96px"
              className="h-4 w-auto shrink-0"
            />
            <span className="text-xs font-bold">
              Official Meta Tech Provider
            </span>
          </span>

          <span className="flex items-center gap-3 rounded-xl border border-(--lp2-ink)/15 bg-white px-4 py-2.5 text-(--lp2-ink)">
            {/* The mark already reads "MSME · Micro, Small & Medium
                Enterprises", so the label beside it only has to carry
                what the artwork does not: the registration. */}
            {/* Intrinsic 600 × 276 — see the Meta mark above for why
                these are the file's real dimensions and not the
                rendered ones. */}
            <Image
              src={MSME_LOGO}
              alt=""
              width={600}
              height={276}
              // Drawn about 78px wide — see the Meta mark above.
              sizes="96px"
              className="h-9 w-auto shrink-0"
            />
            <span className="leading-tight">
              <span className="block text-xs font-bold">Udyam registered</span>
              <span className="block font-mono text-[11px] text-(--lp2-ink-soft)">
                {UDYAM_NUMBER}
              </span>
            </span>
          </span>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-(--lp2-ink)/15 pt-6 text-xs font-medium text-(--lp2-ink-soft) sm:flex-row">
          {/* Rendered per request rather than frozen at build time —
              same as the live footer, and the page is static enough
              that a hardcoded year would go stale silently. */}
          <p>© {new Date().getFullYear()} Instant · Nebkern Technology</p>
          {/* The Meta credential moved up into the chip above; repeating
              it here would say the same thing twice in 60px. */}
          <p>Built on the WhatsApp Business API</p>
        </div>
      </div>
    </footer>
  );
}
