import { Suspense } from 'react';

import { MetaChannelsConfig } from '@/components/settings/meta-channels-config';

// Instagram DMs and Messenger are one setup, not two: a single Facebook
// Login for Business consent returns the Page and the Instagram account
// linked to it, sharing one access token. So this is the only Meta entry
// in the settings rail — the per-channel pages (/settings/instagram,
// /settings/messenger) are sub-pages of it now, reached from the "Full
// setup" link on each channel row rather than from the nav.
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
