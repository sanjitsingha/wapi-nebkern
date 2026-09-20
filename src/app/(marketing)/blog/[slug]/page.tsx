import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ChevronLeft, Newspaper } from 'lucide-react';

import { getPostBySlug, getPublishedPosts, formatPostDate } from '@/lib/blog';
import { buildToc } from '@/lib/lp2-blog-toc';
import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { Sparkle, Squiggle } from '@/components/lp2/decor';
import { postHue } from '@/components/lp2/blog-bits';
import { ShareButtons } from '@/components/lp2/share-buttons';
import '../post-content.css';

export const revalidate = 300;

const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://instant.nebkern.com'
).replace(/\/$/, '');

const PUBLISHER = {
  '@type': 'Organization',
  name: 'Nebkern Technology',
  url: 'https://nebkern.com/',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: 'Post not found — Instant' };

  return {
    // A `meta_title` set in the admin wins outright, suffix included:
    // it was written to be the search result, so adding to it would
    // undo the point of the field.
    //
    // Otherwise the headline stands in. Google cuts titles off around
    // 60 characters, so a long one already fills that and the
    // " — Instant blog" suffix would only be truncated away; shorter
    // ones keep it.
    title: {
      absolute:
        post.metaTitle ??
        (post.title.length > 45 ? post.title : `${post.title} — Instant blog`),
    },
    description: post.excerpt ?? undefined,
    // The live, indexed post page — and since /lp-2/blog/[slug] was
    // deleted, the only one rendering these rows.
    robots: { index: true, follow: true },
    // The post's one official address, matching its sitemap entry.
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: 'article',
      // This openGraph replaces the root one, file-generated share image
      // included, so a post without a cover names the site image itself.
      images: [{ url: post.coverImageUrl ?? '/opengraph-image' }],
    },
  };
}

export default async function Lp2BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  // "Keep reading" — the three most recent other posts. Fetch four in
  // case this post is among the newest, then drop itself.
  const more = (await getPublishedPosts(4))
    .filter((p) => p.id !== post.id)
    .slice(0, 3);

  const hue = postHue(post.slug);

  // Give every h2–h4 an id: `html` is the rewritten body the article
  // renders. The ids stay useful for deep links into a section even
  // though the sidebar that listed them is gone, so the returned `toc`
  // itself is discarded.
  const { html } = buildToc(post.contentHtml);

  // Article structured data, so Google can show the post as an article
  // with its date and publisher. Undefined fields drop out of the JSON.
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt ?? undefined,
    image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    datePublished: post.publishedAt ?? undefined,
    author: post.authorName ? { '@type': 'Person', name: post.authorName } : PUBLISHER,
    publisher: PUBLISHER,
    mainEntityOfPage: `${SITE}/blog/${post.slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Post fields come from the admin panel, so "<" is escaped: a
        // title containing "</script>" must not be able to close this tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleLd).replace(/</g, '\\u003c'),
        }}
      />
      <Lp2Nav />

      <main className="bg-white">
        {/* ── Feature image ──
            The same measure as the article below it, so the two share
            one left and right edge. No border/outline/shadow — just the
            image. */}
        <section className="relative -mt-19 px-4 pt-19 sm:-mt-20 sm:px-6 sm:pt-20">
          <div className="mx-auto max-w-3xl pt-10">
            {/* Way back to the index. Plain text, not a button: on hover
                (or keyboard focus) a green rule grows in from the left
                under the words — the same device as the blog cards on
                the landing page. */}
            <Link
              href="/blog"
              className="group inline-flex items-center gap-1 text-base font-semibold text-(--lp2-ink-soft) transition-colors hover:text-(--lp2-ink) focus-visible:text-(--lp2-ink)"
            >
              <ChevronLeft className="size-4" strokeWidth={3} />
              <span className="bg-[linear-gradient(var(--lp2-grass),var(--lp2-grass))] bg-size-[0%_2px] bg-bottom-left bg-no-repeat pb-0.5 transition-[background-size] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:bg-size-[100%_2px] group-focus-visible:bg-size-[100%_2px] motion-reduce:transition-none">
                Back to blogs
              </span>
            </Link>

            <div className="mt-5">
              {post.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.coverImageUrl}
                  alt=""
                  className="aspect-video w-full object-cover"
                />
              ) : (
                <div
                  className="relative flex aspect-video items-center justify-center overflow-hidden"
                  style={{ backgroundColor: `var(--lp2-${hue}-soft)` }}
                >
                  <span
                    className="flex size-20 items-center justify-center rounded-3xl"
                    style={{
                      backgroundColor: `var(--lp2-${hue})`,
                      transform: 'rotate(-6deg)',
                    }}
                  >
                    <Newspaper className="size-9" strokeWidth={2.5} />
                  </span>
                  <Sparkle color="lemon" className="absolute top-8 right-12 size-6" />
                  <Squiggle color="grape" className="absolute bottom-8 left-10 w-16" />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Article ──
            A single centred column on the same measure as the image
            above it: title, body, then the date and share
            icons. No byline, no read time, and no outlined info strip —
            the page is the post and little else. */}
        <section className="px-4 pb-4 sm:px-6">
          <article className="mx-auto mt-10 max-w-3xl">
            {/* 1. Title. No `text-balance`: evening up the lines pulled
                the last one in and made the block look narrower than the
                image, when it should fill the same measure. */}
            <h1 className="lp2-display text-2xl leading-[1.14] font-extrabold sm:text-4xl">
              {post.title}
            </h1>

            {/* 2. Body. Admin-authored HTML (ids injected by
                buildToc). Writers are ADMIN_EMAILS only — the same
                trust boundary the live blog relies on.

                The excerpt is deliberately not printed here: it belongs
                to the cards that link to the post, and repeating it
                above the body says the same thing twice. It still feeds
                the page description and the share card. */}
            <div
              className="lp2-post mt-8"
              dangerouslySetInnerHTML={{ __html: html }}
            />

            {/* 4. Closing line: date left, share icons right. Plain —
                no box, no rule, no shadow. */}
            <div className="mt-12 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <span className="text-base font-semibold text-(--lp2-ink-soft)">
                {formatPostDate(post.publishedAt)}
              </span>
              <ShareButtons title={post.title} />
            </div>
          </article>
        </section>

        {/* ── Keep reading ──
            Separated by a thin, light divider constrained to the site's
            max width, rather than a thick edge-to-edge rule. */}
        {more.length > 0 && (
          <section className="bg-white pb-16">
            <div className="mx-auto max-w-7xl border-t border-(--lp2-ink)/10 px-4 pt-16 sm:px-6">
              <h2 className="lp2-display text-2xl font-extrabold">
                Keep reading
              </h2>

              <div className="mt-8 grid gap-6 md:grid-cols-3">
                {more.map((p) => (
                  <Link
                    key={p.id}
                    href={`/blog/${p.slug}`}
                    className="group flex flex-col rounded-[1.5rem] border-2 border-(--lp2-ink) bg-(--lp2-cream) p-5 shadow-(--lp2-shadow-sm) transition-transform duration-200 hover:-translate-y-1"
                  >
                    <span
                      aria-hidden
                      className="h-2 w-12 rounded-full border-2 border-(--lp2-ink)"
                      style={{ backgroundColor: `var(--lp2-${postHue(p.slug)})` }}
                    />
                    <p className="mt-3 text-base font-bold text-(--lp2-ink-soft)">
                      {formatPostDate(p.publishedAt)}
                    </p>
                    <h3 className="lp2-display mt-1.5 flex-1 text-lg font-extrabold text-balance">
                      {p.title}
                    </h3>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-extrabold">
                      Read
                      <ArrowRight
                        className="size-4 transition-transform group-hover:translate-x-1"
                        strokeWidth={3}
                      />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Lp2Footer />
    </>
  );
}

