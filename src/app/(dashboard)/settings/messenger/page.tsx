import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { MessengerConfig } from '@/components/settings/messenger-config';

// Messenger on its own — the full-setup path, for connecting just this
// channel, reading its webhook callback URL and verify token, or
// switching Pages without touching Instagram.
//
// A sub-page of /settings/meta, not a rail section: the combined connect
// is what almost everyone should use — one Facebook login brings in this
// Page AND the Instagram account linked to it — so the nav offers that
// one entry and this page is reached from it. Hence the way back at the
// top rather than a buried link.
//
// Suspense boundary because the panel reads ?fb_* params via
// useSearchParams — the redirect fallback of the OAuth callback comes
// back as a full navigation.
export default function MessengerPage() {
  return (
    <div className="space-y-4">
      <Link
        href="/settings/meta"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Instagram &amp; Messenger
      </Link>

      <Suspense fallback={null}>
        <MessengerConfig />
      </Suspense>
    </div>
  );
}
