import type { ReactNode } from 'react';
import { SettingsRail } from '@/components/settings/settings-rail';
import { SettingsContent } from '@/components/settings/settings-content';

// Settings nav lives inside a single bordered, rounded panel — sitting
// in the normal page padding like any other page content — so it
// reads as a distinct settings module, not a continuation of the
// primary app sidebar.
//
// The panel itself is pinned to the available height (`h-full`, which
// resolves against `<main>`'s flex-1 height in dashboard-shell) rather
// than growing with its content. Only the content pane scrolls
// internally — the sidebar (and the panel's own border) stay fixed in
// place, like a real settings app rather than one long scrolling page.
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card lg:flex-row">
      {/* Settings nav — fixed sidebar on lg+, fixed top rail on mobile.
          Never scrolls with the content; it overflows internally instead,
          on both breakpoints. That last part matters: four groups of rows
          plus their headings outgrow a laptop viewport, and the panel
          around it is `overflow-hidden`, so anything the aside doesn't
          scroll itself gets clipped off the bottom. */}
      <aside className="shrink-0 overflow-y-auto border-b border-border bg-muted/40 px-4 pt-4 pb-2 lg:w-60 lg:border-r lg:border-b-0 lg:px-3 lg:py-6">
        <div className="mb-3 px-1 lg:px-3">
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Your account and workspace
          </p>
        </div>
        <SettingsRail />
      </aside>

      {/* Content — the only region that scrolls. Width is capped for the
          form panels but opened up for data-table pages (activity log);
          see SettingsContent. */}
      <SettingsContent>{children}</SettingsContent>
    </div>
  );
}
