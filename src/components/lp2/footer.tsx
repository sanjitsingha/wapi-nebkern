import Link from 'next/link';
import { MessageCircle } from 'lucide-react';

import type { Lp2Hue } from './decor';
import { LEGAL_LINKS } from './legal-links';

// ============================================================
// Footer. Ink panel, so the page closes the way the social-proof strip
// opened it — the two dark bands bookend all the cream in between.
// ============================================================

// The in-page anchors are absolute (`/#features`) rather than bare
// hashes, because this footer also renders on the legal and blog pages —
// a bare `#features` there scrolls to nothing.
const COLUMNS: { title: string; hue: Lp2Hue; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    hue: 'lemon',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'Autopilot', href: '/autopilot' },
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
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        {/* Five columns: the blurb takes two, then three link columns.
            Legal moved out to its own band below — see LEGAL_LINKS. */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl border-2 border-white bg-(--lp2-grass)">
                <MessageCircle className="size-4.5" strokeWidth={2.75} />
              </span>
              <span className="lp2-display text-xl font-extrabold tracking-tight">
                Instant
              </span>
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

        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-white/15 pt-6 text-xs font-medium text-white/55 sm:flex-row">
          {/* Rendered per request rather than frozen at build time —
              same as the live footer, and the page is static enough
              that a hardcoded year would go stale silently. */}
          <p>
            © {new Date().getFullYear()} Instant · Nebkern Technology
          </p>
          <p>Official Meta Tech Provider · Built on the WhatsApp Business API</p>
        </div>
      </div>
    </footer>
  );
}
