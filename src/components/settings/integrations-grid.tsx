'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  Building2,
  Cloud,
  Code2,
  Hash,
  Mail,
  Puzzle,
  Sheet,
  ShoppingBag,
  ShoppingCart,
  Webhook,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { WooCommerceConnect } from './woocommerce-connect';
import { ShopifyConnect } from './shopify-connect';

// ============================================================
// Integrations "app store" — a grid of everything Instant can wire into,
// grouped by how you actually connect it:
//
//   • Built in    — native surfaces that live in this app (API keys, the
//                   webhooks panel right below this grid).
//   • Automation  — Zapier / Make / n8n, which reach the REST API and
//                   webhooks and fan out to thousands of apps.
//   • Popular apps — reached THROUGH those automation platforms today, so
//                   their card is honest: it points at the setup guide,
//                   not a native OAuth flow we don't have yet.
//
// Every CTA goes somewhere real: a settings page, the webhooks panel
// anchor, or the /docs/api-and-integrations guide. No dead buttons.
// ============================================================

type Group = 'builtin' | 'platform' | 'app';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Icon-tile colour. Light-app tokens with a dark: text fallback, to
   *  match the rest of the settings surface. */
  tone: string;
  group: Group;
  /** Where the CTA points. `#webhooks` scrolls to the panel below. */
  href: string;
  external?: boolean;
  cta: string;
}

const INTEGRATIONS: Integration[] = [
  // ── Built in ──────────────────────────────────────────────────────
  {
    id: 'rest-api',
    name: 'REST API',
    description:
      'Generate API keys and call Instant from your own backend — contacts, messages, campaigns and more.',
    icon: Code2,
    tone: 'bg-primary/10 text-primary',
    group: 'builtin',
    href: '/settings/api-access',
    cta: 'Set up keys',
  },
  {
    id: 'webhooks',
    name: 'Outbound webhooks',
    description:
      'Push real-time events (new message, inbound reply, deal moved…) to any URL you own.',
    icon: Webhook,
    tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    group: 'builtin',
    href: '#webhooks',
    cta: 'Configure',
  },
  // ── Automation platforms ──────────────────────────────────────────
  {
    id: 'zapier',
    name: 'Zapier',
    description:
      'Connect Instant to 6,000+ apps with no code, using your API key and webhooks.',
    icon: Zap,
    tone: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    group: 'platform',
    href: '/docs/api-and-integrations',
    cta: 'Setup guide',
  },
  {
    id: 'make',
    name: 'Make',
    description:
      'Build multi-step scenarios visually and trigger them from Instant events.',
    icon: Workflow,
    tone: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400',
    group: 'platform',
    href: '/docs/api-and-integrations',
    cta: 'Setup guide',
  },
  {
    id: 'n8n',
    name: 'n8n',
    description:
      'Self-host your automations and wire Instant in through the REST API and webhooks.',
    icon: Puzzle,
    tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    group: 'platform',
    href: '/docs/api-and-integrations',
    cta: 'Setup guide',
  },
  // ── Popular apps (via automation) ─────────────────────────────────
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    description: 'Log new contacts, replies and deals to a spreadsheet in real time.',
    icon: Sheet,
    tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    group: 'app',
    href: '/docs/api-and-integrations',
    cta: 'Connect via Zapier',
  },
  {
    id: 'zoho-crm',
    name: 'Zoho CRM',
    description: 'Sync WhatsApp leads and conversations into your Zoho CRM records.',
    icon: Building2,
    tone: 'bg-red-500/10 text-red-600 dark:text-red-400',
    group: 'app',
    href: '/docs/api-and-integrations',
    cta: 'Connect via Zapier',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Create and update HubSpot contacts and deals from Instant activity.',
    icon: Building2,
    tone: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    group: 'app',
    href: '/docs/api-and-integrations',
    cta: 'Connect via Zapier',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Push leads and conversation events into your Salesforce org.',
    icon: Cloud,
    tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    group: 'app',
    href: '/docs/api-and-integrations',
    cta: 'Connect via Zapier',
  },
  {
    // Native connect flow (rendered by <ShopifyConnect>).
    id: 'shopify',
    name: 'Shopify',
    description: 'New orders create contacts and fire a Shopify automation.',
    icon: ShoppingBag,
    tone: 'bg-green-500/10 text-green-600 dark:text-green-400',
    group: 'builtin',
    href: '#',
    cta: 'Connect',
  },
  {
    // Native connect flow (rendered by <WooCommerceConnect>, not the
    // generic card) — kept in the data set so its group placement and
    // ordering live here with everything else.
    id: 'woocommerce',
    name: 'WooCommerce',
    description: 'New orders create contacts and fire a WooCommerce automation.',
    icon: ShoppingCart,
    tone: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    group: 'builtin',
    href: '#',
    cta: 'Connect',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get notified in a Slack channel when a new conversation comes in.',
    icon: Hash,
    tone: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    group: 'app',
    href: '/docs/api-and-integrations',
    cta: 'Connect via Zapier',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Email your team when a lead replies, or log conversations to a thread.',
    icon: Mail,
    tone: 'bg-red-500/10 text-red-600 dark:text-red-400',
    group: 'app',
    href: '/docs/api-and-integrations',
    cta: 'Connect via Zapier',
  },
];

const GROUPS: { id: Group; title: string; blurb: string }[] = [
  {
    id: 'builtin',
    title: 'Built in',
    blurb: 'Native to Instant — set up right here.',
  },
  {
    id: 'platform',
    title: 'Automation platforms',
    blurb: 'Connect thousands of apps with no code.',
  },
  {
    id: 'app',
    title: 'Popular apps',
    blurb: 'Connected today through Zapier, Make or n8n.',
  },
];

function IntegrationCard({ item }: { item: Integration }) {
  const primary = item.group === 'builtin';
  const isAnchor = item.href.startsWith('#');
  const isExternal = item.external;

  const ctaClass = cn(
    buttonVariants({ variant: primary ? 'default' : 'outline', size: 'sm' }),
    'mt-4 w-full',
  );

  const ctaInner = (
    <>
      {item.cta}
      <ArrowUpRight className="size-4" />
    </>
  );

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20">
      <span
        className={cn(
          'flex size-10 items-center justify-center rounded-lg',
          item.tone,
        )}
      >
        <item.icon className="size-5" />
      </span>
      <h4 className="mt-3 text-sm font-semibold text-foreground">{item.name}</h4>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
        {item.description}
      </p>

      {isAnchor ? (
        <a href={item.href} className={ctaClass}>
          {ctaInner}
        </a>
      ) : isExternal ? (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={ctaClass}
        >
          {ctaInner}
        </a>
      ) : (
        <Link href={item.href} className={ctaClass}>
          {ctaInner}
        </Link>
      )}
    </div>
  );
}

export function IntegrationsGrid() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-semibold text-foreground">Integrations</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect Instant to the tools you already use. Everything runs on your
          API keys and outbound webhooks — set those up once and the rest
          follows.
        </p>
      </div>

      {GROUPS.map((group) => {
        const items = INTEGRATIONS.filter((i) => i.group === group.id);
        if (items.length === 0) return null;
        return (
          <div key={group.id}>
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="text-sm font-semibold text-foreground">
                {group.title}
              </h4>
              <p className="text-xs text-muted-foreground">{group.blurb}</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) =>
                // WooCommerce & Shopify are native connect flows, not
                // "via Zapier" links.
                item.id === 'woocommerce' ? (
                  <WooCommerceConnect key={item.id} />
                ) : item.id === 'shopify' ? (
                  <ShopifyConnect key={item.id} />
                ) : (
                  <IntegrationCard key={item.id} item={item} />
                ),
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
