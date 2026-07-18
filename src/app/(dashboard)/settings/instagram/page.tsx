import { Suspense } from 'react';
import { InstagramConfig } from '@/components/settings/instagram-config';
import { FeatureGate } from '@/components/billing/feature-gate';

export default function InstagramPage() {
  return (
    <FeatureGate
      feature="allowInstagram"
      label="Instagram DMs"
      description="Bring Instagram Direct Messages into your shared inbox. Upgrade your plan to unlock the Instagram channel."
    >
      <Suspense fallback={null}>
        <InstagramConfig />
      </Suspense>
    </FeatureGate>
  );
}
