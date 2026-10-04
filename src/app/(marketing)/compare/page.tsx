import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { COMPARISONS } from '@/lib/marketing/comparisons';

import { JsonLd } from '@/components/json-ld';
import { ORGANIZATION_SCHEMA, getBreadcrumbSchema, SITE_URL } from '@/lib/marketing/schema';

// ============================================================
// /compare — the index of every comparison page.
//
// Exists for two reasons beyond navigation: it gives each comparison an
// internal link from a page Google already crawls, and it stops
// /compare being a 404 sitting above a set of live children.
// ============================================================

export const metadata: Metadata = {
  title: { absolute: 'Compare WhatsApp platforms — Instant for WhatsApp Business' },
  description:
    'Instant next to the other WhatsApp Business API platforms, on cost, AI, channels and trials — every rival figure taken from their own pricing page and dated.',
  alternates: { canonical: '/compare' },
  robots: { index: true, follow: true },
};

const compareIndexSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    ORGANIZATION_SCHEMA,
    getBreadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Compare', path: '/compare' },
    ]),
    {
      '@type': 'CollectionPage',
      name: 'Compare Instant for WhatsApp Business with other WhatsApp platforms',
      description:
        'Instant next to the other WhatsApp Business API platforms, on cost, AI, channels and trials.',
      url: `${SITE_URL}/compare`,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: COMPARISONS.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `Instant vs ${c.rival}`,
          url: `${SITE_URL}/compare/${c.slug}`,
        })),
      },
    },
  ],
};

export default function CompareIndexPage() {
  return (
    <>
      <JsonLd schema={compareIndexSchema} />
      <Lp2Nav />
      <main>
        <section className="relative -mt-19 bg-(--lp2-sky-soft) pt-19 sm:-mt-20 sm:pt-20">
          <div className="mx-auto max-w-3xl px-4 pt-16 pb-16 text-center sm:px-6 sm:pt-20 sm:pb-20">
            <h1 className="lp2-display mx-auto max-w-2xl text-3xl leading-[1.12] font-extrabold sm:text-[2.6rem]">
              How Instant compares
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-pretty text-(--lp2-ink-soft)">
              Every platform here runs on the same official WhatsApp Business
              API, so the messages and Meta’s charges are identical. What
              differs is the software around them. Each rival’s figures come
              from their own pricing page, with the date we read them.
            </p>
          </div>
        </section>

        {/* `bg-[var(--wa-white,#fff)]`, not `bg-white`: whatsapp.css
            repaints `section.bg-white` to the cream canvas, so the plain
            utility renders cream here and looks like it is doing nothing.
            The fallback keeps it white under the playful design, which
            never defines --wa-white. */}
        <section className="bg-[var(--wa-white,#ffffff)] px-4 py-16 sm:px-6 sm:py-20">
          <ul className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2">
            {COMPARISONS.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/compare/${c.slug}`}
                  className="group flex h-full flex-col rounded-2xl border-2 border-(--lp2-ink)/15 overflow-hidden bg-white transition-transform duration-200 hover:-translate-y-1"
                >
                  {/* Full-bleed to the card edges: the art is the two lockups on
                      a cream field, and insetting it would put a white margin
                      around a cream rectangle. Cards without art start at the
                      heading instead. */}
                  {c.cover && (
                    <Image
                      src={c.cover.src}
                      alt=""
                      width={c.cover.width}
                      height={c.cover.height}
                      sizes="(min-width: 640px) 420px, 92vw"
                      className="h-auto w-full"
                    />
                  )}
                  <div className="flex flex-1 flex-col p-7">
                    <h2 className="lp2-display text-2xl font-extrabold">
                      Instant vs {c.rival}
                    </h2>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-(--lp2-ink-soft)">
                      {c.metaDescription}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold">
                      Read the comparison
                      <ArrowRight className="size-4" strokeWidth={2.75} />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <Lp2Footer />
    </>
  );
}
