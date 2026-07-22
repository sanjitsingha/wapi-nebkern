'use client';

import { ChatWidget } from '@/components/settings/chat-widget';

/**
 * Settings → Chat Widget. Single panel, no tabs — unlike Business
 * Profile it has nothing to split, so it skips the Tabs shell (and with
 * it the useSearchParams/Suspense dance those pages need).
 */
export default function WidgetSettingsPage() {
  return <ChatWidget />;
}
