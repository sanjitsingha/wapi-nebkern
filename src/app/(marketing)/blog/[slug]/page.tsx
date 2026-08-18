import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Clock, Newspaper } from 'lucide-react';

import {
  getPostBySlug,
  getPublishedPosts,
  readMinutes,
  formatPostDate,
} from '@/lib/blog';
import { buildToc } from '@/lib/lp2-blog-toc';
import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { Sparkle, Squiggle } from '@/components/lp2/decor';
import { postHue, TagPill } from '@/components/lp2/blog-bits';
import { BlogToc, PromoBanner } from '@/components/lp2/blog-toc';
import { ShareButtons } from '@/components/lp2/share-buttons';
import '../post-content.css';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: 'Post not found — Instant' };

  return {
    title: { absolute: `${post.title} — Instant blog` },
    description: post.excerpt ?? undefined,
    // The live, indexed post page — and since /lp-2/blog/[slug] was
    // deleted, the only one rendering these rows.
    robots: { index: true, follow: true },
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: 'article',
      ...(post.coverImageUrl ? { images: [{ url: post.coverImageUrl }] } : {}),
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
  const minutes = readMinutes(post.contentHtml);

  // Give every h2–h4 an id and pull out the ToC. `html` is the rewritten
  // body the article renders; `toc` feeds the sidebar.
  const { html, toc } = buildToc(post.contentHtml);

  return (
    <>
      <Lp2Nav />

      <main className="bg-white">
        {/* ── Feature image ──
            Full width (left to right, spanning the whole article
            container), and no border/outline/shadow — just the image. */}
        <section className="relative -mt-19 px-4 pt-19 sm:-mt-20 sm:px-6 sm:pt-20">
          <div className="mx-auto max-w-7xl pt-10">
            {post.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.coverImageUrl}
                alt=""
                className="aspect-[16/5] w-full rounded-[1.75rem] object-cover"
              />
            ) : (
              <div
                className="relative flex aspect-[16/5] items-center justify-center overflow-hidden rounded-[1.75rem]"
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
        </section>

        {/* ── Article ──
            One grid: sticky ToC + promo on the left, and the article on
            the right in reading order — tags, title, excerpt, info box,
            then the body. */}
        <section className="px-4 pb-4 sm:px-6">
          <div className="mx-auto mt-10 grid max-w-7xl gap-10 lg:grid-cols-[15rem_1fr] lg:gap-12">
            {/* Sidebar. Desktop only — on a phone a ToC above the article
                is more clutter than help, and the bottom CTA still
                carries the promo. Sticky so it rides along as you read. */}
            <aside className="hidden lg:sticky lg:top-32 lg:block lg:self-start">
              <BlogToc items={toc} />
              <PromoBanner className={toc.length > 0 ? 'mt-8' : ''} />
            </aside>

            <article className="min-w-0">
              {/* Capped so the header and prose share one readable measure
                  and a common left edge in the wide column. */}
              <div className="max-w-3xl">
                {/* 1. Tags */}
                <div className="flex flex-wrap items-center gap-2">
                  {post.tags.slice(0, 3).map((t) => (
                    <TagPill key={t} tag={t} />
                  ))}
                </div>

                {/* 2. Title */}
                <h1 className="lp2-display mt-4 text-3xl leading-[1.08] font-extrabold text-balance sm:text-5xl">
                  {post.title}
                </h1>

                {/* 3. Excerpt */}
                {post.excerpt && (
                  <p className="mt-5 text-lg leading-relaxed text-pretty text-(--lp2-ink-soft)">
                    {post.excerpt}
                  </p>
                )}

                {/* 4. Info box — full-width outlined strip: byline on
                    the left, share buttons on the right. */}
                <div className="mt-7 flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl border-2 border-(--lp2-ink) bg-white px-4 py-3 shadow-(--lp2-shadow-sm)">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {post.authorName && (
                      <>
                        <span
                          className="flex size-9 items-center justify-center rounded-full border-2 border-(--lp2-ink) text-[11px] font-extrabold"
                          style={{ backgroundColor: `var(--lp2-${hue})` }}
                        >
                          {initials(post.authorName)}
                        </span>
                        <span className="text-sm font-extrabold">
                          {post.authorName}
                        </span>
                        <Dot />
                      </>
                    )}
                    <span className="text-lg font-semibold text-(--lp2-ink-soft)">
                      {formatPostDate(post.publishedAt)}
                    </span>
                    <Dot />
                    <span className="inline-flex items-center gap-1.5 text-lg font-semibold text-(--lp2-ink-soft)">
                      <Clock className="size-3.5" strokeWidth={3} />
                      {minutes} min read
                    </span>
                  </div>

                  <ShareButtons title={post.title} />
                </div>

                {/* 5. Body. Admin-authored HTML (ids injected by
                    buildToc). Writers are ADMIN_EMAILS only — the same
                    trust boundary the live blog relies on. */}
                <div
                  className="lp2-post mt-10 border-t-2 border-(--lp2-ink)/10 pt-10"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            </article>
          </div>
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

/* ─── Bits ────────────────────────────────────────────────────────── */

function Dot() {
  return <span aria-hidden className="size-1.5 rounded-full bg-(--lp2-ink)/25" />;
}

/** First letters of the first two words — "Aarti Rao" → "AR". */
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
