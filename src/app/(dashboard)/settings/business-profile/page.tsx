'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BusinessProfile } from '@/components/settings/business-profile';
import { QuickRepliesManager } from '@/components/settings/quick-replies-manager';
import { Catalog } from '@/components/settings/catalog';

const TABS = ['profile', 'quick-replies', 'catalog'] as const;
type BusinessProfileTab = (typeof TABS)[number];

function isTab(value: string | null): value is BusinessProfileTab {
  return !!value && (TABS as readonly string[]).includes(value);
}

/**
 * Business Profile section — a tabbed shell holding the three
 * customer-facing surfaces. Quick replies and Catalogue used to be their
 * own rail entries; they were folded in here to shorten the settings rail.
 *
 * `?tab=` deep-links a specific tab, so old /settings/catalog-style links
 * (remapped in resolveSection) can land on the right panel. Each tab renders
 * its panel unchanged, so each keeps its own heading + description.
 */
function BusinessProfilePageInner() {
  const raw = useSearchParams().get('tab');
  const initial: BusinessProfileTab = isTab(raw) ? raw : 'profile';

  return (
    <Tabs defaultValue={initial} className="animate-in fade-in-50 duration-200">
      <TabsList variant="line" className="mb-5 gap-4 bg-transparent p-0">
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="quick-replies">Quick replies</TabsTrigger>
        <TabsTrigger value="catalog">Catalogue</TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <BusinessProfile />
      </TabsContent>

      <TabsContent value="quick-replies">
        <QuickRepliesManager />
      </TabsContent>

      <TabsContent value="catalog">
        <Catalog />
      </TabsContent>
    </Tabs>
  );
}

// useSearchParams opts the tree out of static prerendering unless it sits
// under a Suspense boundary — same pattern as /login.
export default function BusinessProfilePage() {
  return (
    <Suspense fallback={null}>
      <BusinessProfilePageInner />
    </Suspense>
  );
}
