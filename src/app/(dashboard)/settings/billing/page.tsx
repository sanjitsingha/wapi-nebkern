import { BillingConfig } from '@/components/settings/billing-config';
import { SubscriptionPanel } from '@/components/settings/subscription-panel';
import { SettingsPanelHead } from '@/components/settings/settings-panel-head';

// Two panels, one section. The heading lives here rather than inside
// either of them: SubscriptionPanel has none of its own, so the page used
// to open with a bare plan card and only reach a heading further down,
// where BillingConfig starts. Now the section is named up top and
// BillingConfig's own head ("WhatsApp usage") reads as the sub-panel it is.
export default function BillingPage() {
  return (
    <>
      <SettingsPanelHead
        title="Billing & usage"
        description="Your plan and activation codes, plus estimated WhatsApp spend for the current billing period."
      />
      <SubscriptionPanel />
      <BillingConfig />
    </>
  );
}
