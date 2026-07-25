import Link from 'next/link';
import { MessageCircle } from 'lucide-react';

import type { Lp2Hue } from './decor';

// ============================================================
// Footer. Ink panel, so the page closes the way the social-proof strip
// opened it — the two dark bands bookend all the cream in between.
// ============================================================

// The in-page anchors are absolute (`/lp-2#features`) rather than bare
// hashes, because this footer also renders on the legal and blog pages —
// a bare `#features` there scrolls to nothing.
const COLUMNS: { title: string; hue: Lp2Hue; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    hue: 'lemon',
    links: [
      { label: 'Features', href: '/lp-2#features' },
      { label: 'AI Agents', href: '/lp-2#ai-agents' },
      { label: 'Pricing', href: '/lp-2#pricing' },
    ],
  },
  {
    title: 'Resources',
    hue: 'sky',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Blog', href: '/lp-2/blog' },
      { label: 'Contact us', href: '/lp-2/contact' },
    ],
  },
  {
    title: 'Legal',
    hue: 'grape',
    links: [
      { label: 'Privacy Policy', href: '/lp-2/privacy' },
      { label: 'Terms & Conditions', href: '/lp-2/terms' },
      { label: 'Cancellation & Refunds', href: '/lp-2/refunds' },
      { label: 'Acceptable Use', href: '/lp-2/acceptable-use' },
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

export function Lp2Footer() {
  return (
    <footer className="border-t-2 border-(--lp2-ink) bg-(--lp2-ink) text-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        {/* Six columns, not five: the blurb takes two and there are now
            four link columns since Legal was added. */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Link href="/lp-2" className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl border-2 border-white bg-(--lp2-grass)">
                <MessageCircle className="size-4.5" strokeWidth={2.75} />
              </span>
              <span className="lp2-display text-xl font-extrabold">wacrm</span>
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

        <div className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-white/15 pt-6 text-xs font-medium text-white/55 sm:flex-row">
          {/* Rendered per request rather than frozen at build time —
              same as the live footer, and the page is static enough
              that a hardcoded year would go stale silently. */}
          <p>© {new Date().getFullYear()} wacrm · Self-hostable CRM for WhatsApp</p>
          <p>Built on the official WhatsApp Business API</p>
        </div>
      </div>
    </footer>
  );
}
