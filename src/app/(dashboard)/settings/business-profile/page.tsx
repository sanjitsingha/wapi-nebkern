'use client';

import { Suspense } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BusinessProfile } from '@/components/settings/business-profile';
import { QuickRepliesManager } from '@/components/settings/quick-replies-manager';
import { Catalog } from '@/components/settings/catalog';
import { useTabParam } from '@/components/settings/use-tab-param';

const TABS = ['profile', 'quick-replies', 'catalog'] as const;

/**
 * Business Profile section — a tabbed shell holding the three
 * customer-facing surfaces. Quick replies and Catalogue used to be their
 * own rail entries; they were folded in here to shorten the settings rail.
 *
 * The active tab is bound to `?tab=` (useTabParam): deep-links like
 * /settings/business-profile?tab=catalog land on the right panel, and
 * switching tabs updates the URL. Each tab renders its panel unchanged, so
 * each keeps its own heading + description.
 */
function BusinessProfilePageInner() {
  const [tab, setTab] = useTabParam(TABS);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(String(value))}
      className="animate-in fade-in-50 duration-200"
    >
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
