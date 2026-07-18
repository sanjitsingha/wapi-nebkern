import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';

import { SiteHeader, SiteFooter } from '@/components/marketing/site-chrome';
import {
  getPostBySlug,
  getPublishedPosts,
  readMinutes,
  formatPostDate,
} from '@/lib/blog';
import '../post-content.css';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: 'Post not found — wacrm' };
  return {
    title: { absolute: `${post.title} — wacrm blog` },
    description: post.excerpt ?? undefined,
    robots: { index: true, follow: true },
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: 'article',
      ...(post.coverImageUrl ? { images: [{ url: post.coverImageUrl }] } : {}),
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  // "More from the blog" — the three most recent other posts.
  const more = (await getPublishedPosts(4)).filter((p) => p.id !== post.id).slice(0, 3);

  const minutes = readMinutes(post.contentHtml);

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 pt-14 pb-20 sm:px-6 sm:pt-20">
          <Link
            href="/blog"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All articles
          </Link>

          <header className="mt-8">
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              {post.tags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="bg-primary-soft text-primary rounded-full px-2 py-0.5 font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-5xl sm:leading-[1.15]">
              {post.title}
            </h1>
            {post.excerpt && (
              <p className="text-muted-foreground mt-4 text-lg leading-relaxed text-pretty">
                {post.excerpt}
              </p>
            )}
            <div className="text-muted-foreground mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {post.authorName && (
                <span className="text-foreground font-medium">
                  {post.authorName}
                </span>
              )}
              <span>{formatPostDate(post.publishedAt)}</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {minutes} min read
              </span>
            </div>
          </header>

          {post.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.coverImageUrl}
              alt=""
              className="mt-10 w-full rounded-2xl object-cover"
            />
          )}

          {/* Admin-authored HTML — writers are trusted (ADMIN_EMAILS only). */}
          <div
            className="post-content mt-10"
            dangerouslySetInnerHTML={{ __html: post.contentHtml }}
          />

          {/* CTA */}
          <div className="border-border bg-card mt-16 flex flex-col items-center gap-4 rounded-2xl border p-8 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <p className="text-foreground text-lg font-semibold">
                Run your business on WhatsApp
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                One shared inbox for your whole team — free to start.
              </p>
            </div>
            <Link
              href="/signup"
              className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold transition-colors"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </article>

        {more.length > 0 && (
          <section className="border-border bg-card/40 border-t">
            <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
              <h2 className="text-xl font-bold tracking-tight">
                More from the blog
              </h2>
              <div className="mt-8 grid gap-6 md:grid-cols-3">
                {more.map((p) => (
                  <Link
                    key={p.id}
                    href={`/blog/${p.slug}`}
                    className="group border-border bg-card rounded-2xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <p className="text-muted-foreground text-xs">
                      {formatPostDate(p.publishedAt)}
                    </p>
                    <h3 className="text-foreground mt-2 font-semibold text-balance">
                      {p.title}
                    </h3>
                    {p.excerpt && (
                      <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                        {p.excerpt}
                      </p>
                    )}
                    <span className="text-primary mt-3 inline-flex items-center gap-1 text-sm font-medium">
                      Read
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
