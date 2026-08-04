import { CallHistory } from '@/components/calls/call-history';
import { FeatureGate } from '@/components/billing/feature-gate';

// Call history. Gated on the same `allowCalling` entitlement as
// Settings → Calling — a plan without calling has no calls to show, so
// the upgrade screen is the honest page rather than an empty list.
export default function CallsPage() {
  return (
    <FeatureGate
      feature="allowCalling"
      label="WhatsApp Calling"
      description="See every voice call to and from your WhatsApp Business number. Upgrade your plan to unlock calling."
    >
      <CallHistory />
    </FeatureGate>
  );
}
