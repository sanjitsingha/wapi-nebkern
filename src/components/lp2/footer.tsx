import Image from 'next/image';
import Link from 'next/link';

import { BrandLogo } from '@/components/brand/logo';
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
    <footer className="border-t-2 border-(--lp2-ink) bg-(--lp2-ink) text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        {/* Five columns: the blurb takes two, then three link columns.
            Legal moved out to its own band below — see LEGAL_LINKS. */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            {/* The lockup is green artwork on transparency, and this
                panel is ink — the wordmark holds up against the dark on
                its own, so unlike the Meta and MSME marks further down
                it needs no white chip to sit on. */}
            <Link href="/" className="flex items-center">
              <BrandLogo className="h-9" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/65">
              The WhatsApp CRM for your whole team — shared inbox, AI agents,
              campaigns and automations on the official Business API.
            </p>
          </div>

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
                      className="text-sm font-medium text-white/65 transition-colors hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Legal band. Its own row so all eleven policies fit without one
            column running three times the height of its neighbours. */}
        <div className="mt-12 border-t border-white/15 pt-8">
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
                  className="text-sm font-medium text-white/65 transition-colors hover:text-white"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Credentials. White chips rather than the plain white-on-ink
            treatment the rest of this panel uses: both lockups are
            near-black artwork and would disappear against the ink
            background — they need their own light surface to sit on.

            `items-stretch` so the two chips match heights: the MSME
            lockup is a stacked three-line mark and sets the taller of
            the two, and hard-coding a height on both would need
            revisiting every time either logo or its label changed. */}
        <div className="mt-10 flex flex-wrap items-stretch gap-3 border-t border-white/15 pt-8">
          <span className="flex items-center gap-2.5 rounded-xl bg-white px-4 py-2.5 text-(--lp2-ink)">
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
              className="h-4 w-auto shrink-0"
            />
            <span className="text-xs font-bold">
              Official Meta Tech Provider
            </span>
          </span>

          <span className="flex items-center gap-3 rounded-xl bg-white px-4 py-2.5 text-(--lp2-ink)">
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

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-white/15 pt-6 text-xs font-medium text-white/55 sm:flex-row">
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
