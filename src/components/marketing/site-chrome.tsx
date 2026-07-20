import Link from 'next/link';
import { MessageSquare } from 'lucide-react';

// ============================================================
// Shared marketing-site chrome — header + footer used by the landing
// page and the public blog, so navigation stays consistent.
// ============================================================

const btnPrimary =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover';
const btnGhost =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted';

function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div
        className={`bg-primary flex items-center justify-center rounded-lg ${
          size === 'md' ? 'h-8 w-8' : 'h-7 w-7'
        }`}
      >
        <MessageSquare
          className={`text-primary-foreground ${size === 'md' ? 'h-4.5 w-4.5' : 'h-4 w-4'}`}
        />
      </div>
      <span
        className={`font-bold tracking-tight ${size === 'md' ? 'text-lg' : ''}`}
      >
        wacrm
      </span>
    </Link>
  );
}

const NAV = [
  { label: 'Features', href: '/#features' },
  { label: 'AI Agents', href: '/#ai-agents' },
  { label: 'Integrations', href: '/#integrations' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Blog', href: '/blog' },
] as const;

export function SiteHeader() {
  return (
    <header className="border-border/70 bg-background/80 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className={`${btnGhost} hidden sm:inline-flex`}>
            Log in
          </Link>
          <Link href="/signup" className={btnPrimary}>
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'AI Agents', href: '/#ai-agents' },
      { label: 'Integrations', href: '/#integrations' },
      { label: 'Pricing', href: '/#pricing' },
    ],
  },
  {
    title: 'Solutions',
    links: [
      { label: 'For Sales', href: '/#teams' },
      { label: 'For Marketing', href: '/#teams' },
      { label: 'For Support', href: '/#teams' },
      { label: 'Customers', href: '/#testimonial' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Blog', href: '/blog' },
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'FAQ', href: '/#faq' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Log in', href: '/login' },
      { label: 'Sign up', href: '/signup' },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-border border-t">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Logo size="sm" />
            <p className="text-muted-foreground mt-3 max-w-xs text-sm leading-relaxed">
              The WhatsApp CRM for your whole team — shared inbox, campaigns,
              automations, and a full CRM on the official Business API.
            </p>
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-foreground text-sm font-semibold">
                {col.title}
              </p>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-border text-muted-foreground mt-10 flex flex-col items-center justify-between gap-2 border-t pt-6 text-xs sm:flex-row">
          <p>
            © {new Date().getFullYear()} wacrm · Self-hostable CRM for
            WhatsApp
          </p>
          <p>Built on the official WhatsApp Business API</p>
        </div>
      </div>
    </footer>
  );
}
