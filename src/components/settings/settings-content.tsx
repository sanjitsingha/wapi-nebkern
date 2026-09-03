'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

// Most settings panels are forms, which read best at a comfortable
// measure — so the content pane caps them at max-w-4xl. A data-table
// panel (the activity log) instead wants the full pane width, matching
// the full-width tables everywhere else in the app. New full-width
// settings pages just add their route prefix here.
const FULL_WIDTH_ROUTES = ['/settings/activity-log'];

export function SettingsContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const fullWidth = FULL_WIDTH_ROUTES.some((r) => pathname?.startsWith(r));

  return (
    <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:px-10 lg:py-8">
      <div className={cn('w-full', fullWidth ? 'max-w-none' : 'max-w-4xl')}>
        {children}
      </div>
    </div>
  );
}
