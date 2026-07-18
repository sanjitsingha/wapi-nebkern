import { CallingConfig } from '@/components/settings/calling-config';
import { FeatureGate } from '@/components/billing/feature-gate';

export default function CallingPage() {
  return (
    <FeatureGate
      feature="allowCalling"
      label="WhatsApp Calling"
      description="Let customers call your WhatsApp Business number. Upgrade your plan to unlock calling."
    >
      <CallingConfig />
    </FeatureGate>
  );
}
