import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { FeatureHero } from '@/components/lp2/feature-page';
import {
  ComparisonCta,
  ComparisonTable,
  ComparisonVerdict,
} from '@/components/lp2/compare-page';
import { KeepReading } from '@/components/lp2/keep-reading';
import { COMPARISONS, getComparison } from '@/lib/marketing/comparisons';

// ============================================================
// /compare/<slug> — one page per rival, all of them from
// lib/marketing/comparisons.ts.
//
// Statically generated from that list, so an unknown slug 404s rather
// than rendering an empty comparison. Adding a rival means adding an
// object there; nothing in this file changes.
// ============================================================

/** Only the slugs we have data for; anything else is a 404. */
export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = getComparison(slug);
  if (!data) return {};

  return {
    title: { absolute: data.title },
    description: data.metaDescription,
    alternates: { canonical: `/compare/${data.slug}` },
    robots: { index: true, follow: true },
    // Root openGraph is replaced wholesale, not merged, so siteName has
    // to be repeated here or the card loses the product's name.
    openGraph: {
      siteName: 'Instant',
      title: data.title,
      description: data.metaDescription,
      url: `/compare/${data.slug}`,
      type: 'article',
    },
  };
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = getComparison(slug);
  if (!data) notFound();

  return (
    <>
      <Lp2Nav />
      <main>
        <FeatureHero
          eyebrow="Comparison"
          title={`Instant vs ${data.rival}`}
          highlight={data.rival}
          hue={data.hue}
          body={data.intro}
        />
        <ComparisonTable data={data} />
        <ComparisonVerdict data={data} />
        <ComparisonCta data={data} />
        <KeepReading
          links={[
            {
              href: '/pricing',
              title: 'What Instant costs',
              blurb:
                'Three plans, the whole product on each, and Meta’s conversation charges billed to you at Meta’s own rates.',
            },
            {
              href: '/features/shared-inbox',
              title: 'One number, the whole team',
              blurb:
                'WhatsApp, Instagram and Messenger in a single inbox, with assignment, notes and full history on the contact.',
            },
            {
              href: '/ask-maya',
              title: 'Maya answers first',
              blurb:
                'The AI agent replies from your own content around the clock and hands over the moment a person is needed.',
            },
          ]}
        />
      </main>
      <Lp2Footer />
    </>
  );
}
