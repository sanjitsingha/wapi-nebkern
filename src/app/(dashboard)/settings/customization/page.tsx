'use client';

import { Suspense } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FieldsAndTagsPanel } from '@/components/settings/fields-and-tags-panel';
import { DealsSettings } from '@/components/settings/deals-settings';
import { useTabParam } from '@/components/settings/use-tab-param';

const TABS = ['fields', 'deals'] as const;

/**
 * Customization section — a tabbed shell for the "shape your data" settings.
 * Fields & tags and Deals & currency used to be their own rail entries; they
 * were folded in here to shorten the settings rail.
 *
 * The active tab is bound to `?tab=` (useTabParam): the sidebar's Deals
 * shortcut lands here, and switching tabs updates the URL. Each tab renders
 * its panel unchanged, so each keeps its own heading + description.
 */
function CustomizationPageInner() {
  const [tab, setTab] = useTabParam(TABS);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(String(value))}
      className="animate-in fade-in-50 duration-200"
    >
      <TabsList variant="line" className="mb-5 gap-4 bg-transparent p-0">
        <TabsTrigger value="fields">Fields &amp; tags</TabsTrigger>
        <TabsTrigger value="deals">Deals &amp; currency</TabsTrigger>
      </TabsList>

      <TabsContent value="fields">
        <FieldsAndTagsPanel />
      </TabsContent>

      <TabsContent value="deals">
        <DealsSettings />
      </TabsContent>
    </Tabs>
  );
}

// useSearchParams opts the tree out of static prerendering unless it sits
// under a Suspense boundary — same pattern as /login.
export default function CustomizationPage() {
  return (
    <Suspense fallback={null}>
      <CustomizationPageInner />
    </Suspense>
  );
}
