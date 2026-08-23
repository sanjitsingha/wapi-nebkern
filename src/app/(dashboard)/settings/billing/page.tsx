import { BillingConfig } from '@/components/settings/billing-config';
import { SettingsPanelHead } from '@/components/settings/settings-panel-head';

// One panel, one subject: what META bills you for conversations.
//
// This page used to open with a plan summary above the usage panel,
// which made "Billing" read as the place you manage your Instant
// subscription. It is not — that lives on Profile → Plan, and having a
// second, thinner copy of it here is what made the two impossible to
// tell apart. The plan summary is gone and the activation-code box that
// travelled with it moved next to the real plan panel.
//
// The route stays /settings/billing so existing links keep working; only
// what the page contains and what the rail calls it have changed.
export default function BillingPage() {
  return (
    <>
      <SettingsPanelHead
        title="Meta charges"
        description="What Meta bills you for WhatsApp conversations this period, from their conversation analytics — separate from your Instant plan. Meta does not expose a live wallet balance by API, so open WhatsApp Manager for your actual balance and invoices."
      />
      <BillingConfig />
    </>
  );
}
