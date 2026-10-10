import { notFound } from 'next/navigation';

import { FeatureGate } from '@/components/billing/feature-gate';
import { IntegrationPage } from '@/components/settings/integration-page';
import { INTEGRATIONS } from '@/components/settings/integrations-catalog';

// Settings → Integrations → one integration. The settings rail lists
// every integration and links each here; /settings/integrations itself
// stays as the grid of all of them. REST API has no page of its own
// here — it is the API access section.
export default async function IntegrationDetailPage({
  params,
}: {
  params: Promise<{ integration: string }>;
}) {
  const { integration } = await params;
  const item = INTEGRATIONS.find((i) => i.id === integration);
  if (!item || item.id === 'rest-api') notFound();

  return (
    <FeatureGate
      feature="allowIntegrations"
      label={item.name}
      description={`Connect ${item.name} and your other tools to Instant. Upgrade your plan to unlock integrations.`}
    >
      <IntegrationPage id={item.id} />
    </FeatureGate>
  );
}
