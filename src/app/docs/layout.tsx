import type { Metadata } from 'next';

import { SiteHeader, SiteFooter } from '@/components/marketing/site-chrome';
import { DocsShell } from '@/components/docs/docs-shell';

// Public docs — indexed, unlike the authenticated app.
export const metadata: Metadata = {
  title: { template: '%s — wacrm docs', default: 'Documentation — wacrm' },
  description:
    'Everything wacrm can do — channels, the shared inbox, CRM, campaigns, automations, AI agents, billing, and the API — documented in detail.',
  robots: { index: true, follow: true },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1">
        <DocsShell>{children}</DocsShell>
      </main>
      <SiteFooter />
    </div>
  );
}
