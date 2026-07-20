'use client';

import { Suspense } from 'react';

import { MessengerConfig } from '@/components/settings/messenger-config';

// useSearchParams (inside MessengerConfig, for the OAuth ?fb_* params)
// opts the tree out of static prerendering unless it sits under a
// Suspense boundary — same pattern as the Instagram settings page.
export default function MessengerPage() {
  return (
    <Suspense fallback={null}>
      <MessengerConfig />
    </Suspense>
  );
}
