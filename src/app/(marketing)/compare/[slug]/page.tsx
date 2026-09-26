import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import {
  ComparisonHero,
  ComparisonTable,
} from '@/components/lp2/compare-page';
import { ComparisonVerdictTabs } from '@/components/lp2/compare-verdict-tabs';
import { WaClosingCta } from '@/components/wa/closing-cta';
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
        <ComparisonHero data={data} />
        <ComparisonTable data={data} />
        <ComparisonVerdictTabs data={data} />
        <WaClosingCta />
      </main>
      <Lp2Footer />
    </>
  );
}
