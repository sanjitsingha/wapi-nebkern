import type { Metadata } from 'next';

import { getPublishedPosts, formatPostDate } from '@/lib/blog';
import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import {
  Lp2BlogBrowser,
  type BlogListItem,
} from '@/components/lp2/blog-browser';

// Same 5-minute window as the live blog — posts are edited in the admin
// panel, and waiting for a full rebuild to see a fix is worse than a
// slightly stale index.
export const revalidate = 300;

// The live, indexed blog at /blog. There was a second copy at
// /lp-2/blog reading the same table, kept noindexed so it could not
// compete for the same content; that route is deleted, so this is now
// the only page these posts render on.
export const metadata: Metadata = {
  title: { absolute: 'Blog — wacrm' },
  description:
    'Insights to scale your brand with WhatsApp automation and AI-powered business intelligence.',
  robots: { index: true, follow: true },
};

export default async function Lp2BlogIndexPage() {
  const posts = await getPublishedPosts();

  // Flatten to the shape the client browser needs, formatting dates
  // here so that component never has to import the data layer.
  const items: BlogListItem[] = posts.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    coverImageUrl: p.coverImageUrl,
    tags: p.tags,
    dateLabel: formatPostDate(p.publishedAt),
  }));

  return (
    <>
      <Lp2Nav />
      <main>
        <Lp2BlogBrowser posts={items} />
      </main>
      <Lp2Footer />
    </>
  );
}
