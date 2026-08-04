import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { InstagramConfig } from '@/components/settings/instagram-config';
import { FeatureGate } from '@/components/billing/feature-gate';

// Instagram on its own — the full-setup path, for connecting just this
// channel, reading its webhook callback URL and verify token, or
// entering Page credentials by hand when the combined login can't reach
// the account.
//
// A sub-page of /settings/meta, not a rail section: the combined connect
// is what almost everyone should use — one Facebook login brings in the
// Instagram account AND the Page it is linked to, and produces the Page
// token the send path actually needs — so the nav offers that one entry
// and this page is reached from it.
//
// Plan-gated here (unlike /settings/meta, which always delivers
// Messenger and skips only the Instagram half) — this page is Instagram
// and nothing else, so there is nothing to show without the entitlement.
export default function InstagramPage() {
  return (
    <div className="space-y-4">
      <Link
        href="/settings/meta"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Instagram &amp; Messenger
      </Link>

      <FeatureGate
        feature="allowInstagram"
        label="Instagram DMs"
        description="Bring Instagram Direct Messages into your shared inbox. Upgrade your plan to unlock the Instagram channel."
      >
        <Suspense fallback={null}>
          <InstagramConfig />
        </Suspense>
      </FeatureGate>
    </div>
  );
}
