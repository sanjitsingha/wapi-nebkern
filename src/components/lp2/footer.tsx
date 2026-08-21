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
      { label: 'Features', href: '/#features' },
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
            <Image
              src={META_LOGO}
              alt=""
              width={79}
              height={16}
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
            <Image
              src={MSME_LOGO}
              alt=""
              width={78}
              height={36}
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
