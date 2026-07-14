'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FieldsAndTagsPanel } from '@/components/settings/fields-and-tags-panel';
import { DealsSettings } from '@/components/settings/deals-settings';

const TABS = ['fields', 'deals'] as const;
type CustomizationTab = (typeof TABS)[number];

function isTab(value: string | null): value is CustomizationTab {
  return !!value && (TABS as readonly string[]).includes(value);
}

/**
 * Customization section — a tabbed shell for the "shape your data" settings.
 * Fields & tags and Deals & currency used to be their own rail entries; they
 * were folded in here to shorten the settings rail.
 *
 * `?tab=` deep-links a specific tab (the sidebar's Deals shortcut relies on
 * it). Each tab renders its panel unchanged, so each keeps its own heading +
 * description.
 */
function CustomizationPageInner() {
  const raw = useSearchParams().get('tab');
  const initial: CustomizationTab = isTab(raw) ? raw : 'fields';

  return (
    <Tabs defaultValue={initial} className="animate-in fade-in-50 duration-200">
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
