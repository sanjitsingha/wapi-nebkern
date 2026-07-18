import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Newspaper } from 'lucide-react';

import { SiteHeader, SiteFooter } from '@/components/marketing/site-chrome';
import { getPublishedPosts, formatPostDate, type BlogPostMeta } from '@/lib/blog';

export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: 'Blog — wacrm' },
  description:
    'Product updates, WhatsApp Business API guides, and playbooks for teams selling and supporting on WhatsApp.',
  robots: { index: true, follow: true },
};

function PostCard({ post, featured }: { post: BlogPostMeta; featured?: boolean }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`group border-border bg-card flex flex-col overflow-hidden rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-md ${
        featured ? 'md:col-span-2 lg:col-span-3 lg:flex-row' : ''
      }`}
    >
      {/* Cover — image when set, branded placeholder otherwise. */}
      <div
        className={`bg-muted relative overflow-hidden ${
          featured ? 'aspect-16/9 lg:aspect-auto lg:w-1/2' : 'aspect-16/9'
        }`}
      >
        {post.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="from-emerald-950 via-emerald-900 to-emerald-800 absolute inset-0 flex items-center justify-center bg-linear-to-br">
            <Newspaper className="h-8 w-8 text-emerald-200/40" />
          </div>
        )}
      </div>

      <div className={`flex flex-1 flex-col p-6 ${featured ? 'lg:p-10' : ''}`}>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          {post.tags.slice(0, 2).map((t) => (
            <span
              key={t}
              className="bg-primary-soft text-primary rounded-full px-2 py-0.5 font-medium"
            >
              {t}
            </span>
          ))}
          <span>{formatPostDate(post.publishedAt)}</span>
        </div>
        <h2
          className={`text-foreground mt-3 font-bold tracking-tight text-balance ${
            featured ? 'text-2xl sm:text-3xl' : 'text-lg'
          }`}
        >
          {post.title}
        </h2>
        {post.excerpt && (
          <p
            className={`text-muted-foreground mt-2 text-sm leading-relaxed ${
              featured ? 'line-clamp-3 sm:text-base' : 'line-clamp-2'
            }`}
          >
            {post.excerpt}
          </p>
        )}
        <span className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-medium">
          Read article
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

export default async function BlogIndexPage() {
  const posts = await getPublishedPosts();
  const [first, ...rest] = posts;

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-20 sm:pb-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-primary text-sm font-semibold">Blog</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Ideas for teams that live on WhatsApp
            </h1>
            <p className="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
              Product updates, Business API guides, and playbooks for selling
              and supporting over WhatsApp.
            </p>
          </div>

          {posts.length === 0 ? (
            <div className="border-border bg-muted/20 mx-auto mt-16 flex max-w-md flex-col items-center rounded-2xl border border-dashed px-6 py-16 text-center">
              <Newspaper className="text-muted-foreground h-8 w-8" />
              <p className="text-foreground mt-4 text-sm font-medium">
                No articles yet
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                We&apos;re writing — check back soon.
              </p>
            </div>
          ) : (
            <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {first && <PostCard post={first} featured />}
              {rest.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
