import { Suspense } from 'react';

import { MetaChannelsConfig } from '@/components/settings/meta-channels-config';

// Instagram DMs and Messenger are one setup, not two: a single Facebook
// Login for Business consent returns the Page and the Instagram account
// linked to it, sharing one access token. The old per-channel sections
// (/settings/instagram, /settings/messenger) now redirect here.
//
// Suspense boundary because the panel reads ?meta_* params via
// useSearchParams — the OAuth callback comes back as a full navigation.
export default function MetaChannelsPage() {
  return (
    <Suspense fallback={null}>
      <MetaChannelsConfig />
    </Suspense>
  );
}
