import type { Metadata } from 'next';

import '../(marketing)/lp2.css';

import { lp2Display } from '@/components/lp2/font';
import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { DocsShell } from '@/components/docs/docs-shell';
import { Analytics } from '@/components/analytics';

// Public docs — indexed, unlike the authenticated app.
export const metadata: Metadata = {
  title: { template: '%s — Instant docs', default: 'Documentation — Instant' },
  description:
    'Everything Instant can do — channels, the shared inbox, CRM, campaigns, automations, AI agents, billing, and the API — documented in detail.',
  robots: { index: true, follow: true },
};

// Shares the lp2 nav/footer and design tokens with `/` (same brand,
// same chrome) but the content area (docs-shell.tsx, docs-components.tsx)
// is deliberately restrained — no blobs, no stickers — since this is a
// reference someone is reading carefully, not a pitch. See legal.tsx
// for the same "serious but on-brand" treatment applied to the legal
// pages.
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`lp2 ${lp2Display.variable} min-h-screen bg-(--lp2-cream) text-(--lp2-ink) antialiased`}>
      <Lp2Nav />
      <main>
        <DocsShell>{children}</DocsShell>
      </main>
      <Lp2Footer />
      {/* Docs are public, so they count towards the funnel. */}
      <Analytics />
    </div>
  );
}
