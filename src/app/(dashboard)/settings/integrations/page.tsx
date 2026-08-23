import { WebhooksPanel } from '@/components/settings/webhooks-panel';
import { IntegrationsGrid } from '@/components/settings/integrations-grid';
import { FeatureGate } from '@/components/billing/feature-gate';

export default function IntegrationsPage() {
  return (
    <FeatureGate
      feature="allowIntegrations"
      label="Webhooks & integrations"
      description="Connect Zapier, Make, n8n, or your own backend with outbound webhooks. Upgrade your plan to unlock integrations."
    >
      <div className="space-y-10">
        <IntegrationsGrid />

        {/* The real outbound-webhook config. The grid's "Outbound webhooks"
            card scrolls here; scroll-mt keeps it clear of the sticky header. */}
        <div id="webhooks" className="scroll-mt-20">
          <WebhooksPanel />
        </div>
      </div>
    </FeatureGate>
  );
}
