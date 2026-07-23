import Link from 'next/link';
import { ChevronDown, MessageSquare } from 'lucide-react';

import { cn } from '@/lib/utils';
import { HeaderCta } from './header-cta';

// ============================================================
// Shared marketing-site chrome — header + footer used by the landing
// page and the public blog, so navigation stays consistent.
// ============================================================

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
  { label: 'AI Agents', href: '/#ai-agents' },
  { label: 'Integrations', href: '/#integrations' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Docs', href: '/docs' },
  { label: 'Blog', href: '/blog' },
] as const;

/**
 * The Features mega-menu — the major capabilities only, grouped by what
 * the customer is trying to do. Each group is a column; each row is one
 * capability with a one-line hook.
 */
const FEATURE_MENU = [
  {
    heading: 'Engage',
    items: [
      { label: 'Shared Team Inbox', desc: 'One inbox, the whole team', href: '/docs/inbox' },
      { label: 'Multi-channel Messaging', desc: 'WhatsApp, Messenger & Instagram', href: '/docs/whatsapp' },
    ],
  },
  {
    heading: 'Automate with AI',
    items: [
      { label: 'AI Agents', desc: 'Answer & qualify 24/7', href: '/docs/ai-agents' },
      { label: 'No-code Flows', desc: 'Automate every follow-up', href: '/docs/flows' },
    ],
  },
  {
    heading: 'Grow',
    items: [
      { label: 'Broadcast Campaigns', desc: 'Bulk template sends', href: '/docs/campaigns' },
      { label: 'Segments & Lists', desc: 'Target the right people', href: '/docs/segments-and-lists' },
    ],
  },
  {
    heading: 'Organize',
    items: [
      { label: 'Contacts & CRM', desc: 'Every lead you own', href: '/docs/contacts' },
      { label: 'Sales Pipelines', desc: 'Drag deals to close', href: '/docs/pipelines' },
    ],
  },
] as const;

/**
 * "Features" opens a mega-menu that spans the full width of the header.
 *
 * CSS-only (group-hover + group-focus-within) so the header stays a
 * server component and the menu still opens on keyboard focus. The
 * trigger is `h-16` — the full header height — so there is no dead gap
 * between it and the panel for the pointer to fall through, and the
 * wrapper stays `static` so the panel resolves its `inset-x-0` against
 * the sticky header and stretches edge to edge.
 */
function FeaturesMenu() {
  return (
    <div className="group/feat static">
      <button
        type="button"
        aria-haspopup="true"
        className="text-muted-foreground hover:text-foreground group-focus-within/feat:text-foreground flex h-16 items-center gap-1 text-sm font-medium transition-colors"
      >
        Features
        <ChevronDown className="size-4 transition-transform duration-200 group-hover/feat:rotate-180 group-focus-within/feat:rotate-180" />
      </button>

      <div
        className={cn(
          'invisible absolute inset-x-0 top-full z-40 translate-y-1 opacity-0 transition-all duration-200',
          'group-hover/feat:visible group-hover/feat:translate-y-0 group-hover/feat:opacity-100',
          'group-focus-within/feat:visible group-focus-within/feat:translate-y-0 group-focus-within/feat:opacity-100',
        )}
      >
        <div className="border-border bg-background border-b shadow-lg">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURE_MENU.map((col) => (
                <div key={col.heading}>
                  <p className="text-muted-foreground/70 mb-3 text-xs font-semibold tracking-wider uppercase">
                    {col.heading}
                  </p>
                  <ul className="space-y-3">
                    {col.items.map((it) => (
                      <li key={it.label}>
                        <Link
                          href={it.href}
                          className="hover:bg-muted block rounded-lg p-2 transition-colors"
                        >
                          <span className="text-foreground block text-sm font-medium">
                            {it.label}
                          </span>
                          <span className="text-muted-foreground block text-xs leading-snug">
                            {it.desc}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="border-border/70 bg-background sticky top-0 z-50 border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-8 md:flex">
          <FeaturesMenu />
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
          <HeaderCta />
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
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Blog', href: '/blog' },
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
