import Link from 'next/link';
import { PenSquare } from 'lucide-react';

import { adminDb } from '../../_lib/admin-db';
import { BlogPostsTable, type BlogPostRow } from '../../_components/blog-posts-table';

export const dynamic = 'force-dynamic';

export default async function AdminBlogPage() {
  const { data } = await adminDb()
    .from('blog_posts')
    .select('id, slug, title, excerpt, status, tags, published_at, updated_at')
    .order('updated_at', { ascending: false });

  const posts = (data ?? []) as BlogPostRow[];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Blog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Write and publish posts for the marketing site&apos;s /blog.
          </p>
        </div>
        <Link
          href="/admin/blog/editor"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <PenSquare className="size-4" />
          New post
        </Link>
      </div>

      <BlogPostsTable posts={posts} />
    </div>
  );
}
