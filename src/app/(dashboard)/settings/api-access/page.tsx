import { ApiKeysPanel } from '@/components/settings/api-keys-panel';
import { FeatureGate } from '@/components/billing/feature-gate';

export default function ApiAccessPage() {
  return (
    <FeatureGate
      feature="allowIntegrations"
      label="API access"
      description="Generate API keys to connect external software to wacrm. Upgrade your plan to unlock API access."
    >
      <ApiKeysPanel />
    </FeatureGate>
  );
}
