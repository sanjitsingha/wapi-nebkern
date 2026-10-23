import type { Metadata } from 'next';

import '../(marketing)/lp2.css';
import '../(marketing)/whatsapp.css';
import './docs.css';

import { AppFont } from '@/components/app-font';
import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { DocsShell } from '@/components/docs/docs-shell';
import { Analytics } from '@/components/analytics';
import { getSiteDesign } from '@/lib/marketing/site-design.server';

// Public docs — indexed, unlike the authenticated app.
export const metadata: Metadata = {
  // `default` is the docs index's own title. The root layout's
  // '%s — Dripo' template still wraps it, so it must not say
  // "— Dripo" itself — that is how the index read
  // "Documentation — Dripo — Dripo".
  // Deliberately the short name: '%s — Dripo WhatsApp for Business
  // docs' spends 40 characters on the suffix before the page name is
  // counted, and docs pages are read by people who already know the
  // product. The full brand is still declared in the schema below.
  title: { template: '%s — Dripo docs', default: 'Documentation' },
  description:
    'Everything Dripo can do — channels, the shared inbox, CRM, campaigns, automations, AI agents, billing, and the API — documented in detail.',
  robots: { index: true, follow: true },
};

// Shares the lp2 nav/footer and design tokens with `/` (same brand,
// same chrome) but the content area (docs-shell.tsx, docs-components.tsx)
// is deliberately restrained — no blobs, no stickers — since this is a
// reference someone is reading carefully, not a pitch. See legal.tsx
// for the same "serious but on-brand" treatment applied to the legal
// pages.
export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  // Same design cookie as the marketing pages — see whatsapp.css.
  const { design } = await getSiteDesign();

  return (
    <>
      <AppFont />
      <div
        data-design={design}
        className="lp2 docs-layout min-h-screen bg-white text-(--lp2-ink) antialiased font-sans"
        style={{
          backgroundColor: '#ffffff',
          '--wa-canvas': '#ffffff',
          '--lp2-cream': '#ffffff',
        } as React.CSSProperties}
      >
        <Lp2Nav />
        <main>
          <DocsShell>{children}</DocsShell>
        </main>
        <Lp2Footer />
        {/* Docs are public, so they count towards the funnel. */}
        <Analytics />
      </div>
    </>
  );
}
