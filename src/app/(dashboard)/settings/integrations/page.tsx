import { WebhooksPanel } from '@/components/settings/webhooks-panel';
import { FeatureGate } from '@/components/billing/feature-gate';

export default function IntegrationsPage() {
  return (
    <FeatureGate
      feature="allowIntegrations"
      label="Webhooks & integrations"
      description="Connect Zapier, Make, n8n, or your own backend with outbound webhooks. Upgrade your plan to unlock integrations."
    >
      <WebhooksPanel />
    </FeatureGate>
  );
}
