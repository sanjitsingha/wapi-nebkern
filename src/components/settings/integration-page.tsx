'use client';

import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ShopifyConnect } from './shopify-connect';
import { WooCommerceConnect } from './woocommerce-connect';
import { ZohoConnect } from './zoho-connect';
import { ZapierConnect } from './zapier-guide';
import { WebhooksPanel } from './webhooks-panel';
import { ConnectHero, IntegrationHeader, ToolMark } from './integration-visuals';
import { GoogleSheetsConnect } from './google-sheets-connect';
import {
  INTEGRATIONS,
  INTEGRATIONS_DOCS_HREF,
  connectKind,
  type ConnectCardArgs,
  type Integration,
} from './integrations-catalog';

// ============================================================
// /settings/integrations/[integration] — one integration's own page.
//
// A header (name, what it does, the docs), then either a "connect" hero
// — Instant and the tool side by side with a Connect button — or, once
// a native integration is connected, its status with a Manage button.
//
// The page draws the cards; the existing connect components keep their
// dialogs and their connection logic (see ConnectCardArgs). So "Connect"
// here and "Connect" on the grid open the same dialog and save the same
// connection.
// ============================================================

function ConnectedCard({ item, card }: { item: Integration; card: ConnectCardArgs }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-5">
      <ToolMark item={item} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {item.name}
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3" />
            Connected
          </span>
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
      </div>
      <Button variant="outline" onClick={card.open} className="h-9 px-4">
        Manage
      </Button>
    </div>
  );
}

/** A native integration's card: the hero until it's connected. */
function nativeCard(item: Integration) {
  function NativeCard(card: ConnectCardArgs) {
    return card.connected ? (
      <ConnectedCard item={item} card={card} />
    ) : (
      <ConnectHero
        item={item}
        label="Connect"
        onConnect={card.open}
        loading={card.loading}
      />
    );
  }
  return NativeCard;
}

export function IntegrationPage({ id }: { id: string }) {
  const item = INTEGRATIONS.find((i) => i.id === id);
  if (!item) return null;
  const kind = connectKind(item.id);

  // Google Sheets draws its own header: its "Add New Sheet" button sits
  // beside the docs link and drives dialogs that live in that component.
  if (item.id === 'google-sheets') return <GoogleSheetsConnect item={item} />;

  return (
    <div className="space-y-6">
      <IntegrationHeader
        item={item}
        subtitle={kind === 'panel' ? item.description : undefined}
      />

      {kind === 'panel' && <WebhooksPanel />}

      {kind === 'native' &&
        (item.id === 'shopify' ? (
          <ShopifyConnect renderCard={nativeCard(item)} />
        ) : item.id === 'woocommerce' ? (
          <WooCommerceConnect renderCard={nativeCard(item)} />
        ) : (
          <ZohoConnect renderCard={nativeCard(item)} />
        ))}

      {kind === 'zapier' && (
        <ZapierConnect
          renderCard={(card) => (
            <ConnectHero
              item={item}
              label="Open setup guide"
              onConnect={card.open}
              note="There's no app to install: Zapier's Webhooks step talks to Instant with your API key."
            />
          )}
        />
      )}

      {kind === 'via-zapier' && (
        <ZapierConnect
          renderCard={(card) => (
            <ConnectHero
              item={item}
              label="Connect via Zapier"
              onConnect={card.open}
              note={`${item.name} connects to Instant through Zapier today. The guide walks you through it.`}
            />
          )}
        />
      )}

      {kind === 'docs' && (
        <ConnectHero
          item={item}
          label="Open setup guide"
          href={INTEGRATIONS_DOCS_HREF}
          note={`${item.name} talks to Instant through its own webhook and HTTP steps, using your API key.`}
        />
      )}
    </div>
  );
}
