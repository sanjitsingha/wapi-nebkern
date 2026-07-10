import { Suspense } from 'react';
import { InstagramConfig } from '@/components/settings/instagram-config';

export default function InstagramPage() {
  return (
    <Suspense fallback={null}>
      <InstagramConfig />
    </Suspense>
  );
}
