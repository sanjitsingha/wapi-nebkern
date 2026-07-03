'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DEFAULT_SECTION,
  resolveSection,
  sectionHref,
} from '@/components/settings/settings-sections';

// There is no Overview landing anymore — /settings forwards to the
// default section. Legacy ?tab= deep-links (old bookmarks, external
// links) are resolved to their new homes first.
export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsRedirect />
    </Suspense>
  );
}

function SettingsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get('tab');
    const section = tab ? resolveSection(tab) : DEFAULT_SECTION;
    router.replace(sectionHref(section));
  }, [searchParams, router]);

  return null;
}
