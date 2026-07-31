'use client';

import { FieldsAndTagsPanel } from '@/components/settings/fields-and-tags-panel';

/**
 * Customization section — "shape your data" settings.
 *
 * This was a tabbed shell for "Fields & tags" and "Deals & currency", but
 * the currency control moved to the pipeline board's Config modal (it lives
 * next to the deals it governs now). Only Fields & tags remains, so the tab
 * shell is gone and the panel renders directly.
 */
export default function CustomizationPage() {
  return <FieldsAndTagsPanel />;
}
