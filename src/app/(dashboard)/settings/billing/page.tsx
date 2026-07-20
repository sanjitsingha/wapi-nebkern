import { BillingConfig } from '@/components/settings/billing-config';
import { SubscriptionPanel } from '@/components/settings/subscription-panel';

export default function BillingPage() {
  return (
    <>
      <SubscriptionPanel />
      <BillingConfig />
    </>
  );
}
