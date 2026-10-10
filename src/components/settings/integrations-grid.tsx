'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { WooCommerceConnect } from './woocommerce-connect';
import { ShopifyConnect } from './shopify-connect';
import { ZohoConnect } from './zoho-connect';
import { ZapierConnect } from './zapier-guide';
import {
  GROUPS,
  INTEGRATIONS,
  type Integration,
} from './integrations-catalog';

// The grid on /settings/integrations. What it lists, and in which group,
// is the catalog in ./integrations-catalog — shared with the settings
// rail, which gives each entry a page of its own.

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
      {item.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.logo} alt="" className="size-10 object-contain" />
      ) : (
        <span
          className={cn(
            'flex size-10 items-center justify-center rounded-lg',
            item.tone,
          )}
        >
          <item.icon className="size-5" />
        </span>
      )}
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
                // WooCommerce, Shopify & Zoho are native connect flows,
                // not "via Zapier" links. Zapier itself opens an
                // in-app setup guide instead of the docs page.
                item.id === 'woocommerce' ? (
                  <WooCommerceConnect key={item.id} />
                ) : item.id === 'shopify' ? (
                  <ShopifyConnect key={item.id} />
                ) : item.id === 'zoho-crm' ? (
                  <ZohoConnect key={item.id} />
                ) : item.id === 'zapier' ? (
                  <ZapierConnect key={item.id} />
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
