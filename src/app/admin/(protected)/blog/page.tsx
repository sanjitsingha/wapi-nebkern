import Link from 'next/link';
import { PenSquare } from 'lucide-react';

import { adminDb } from '../../_lib/admin-db';
import {
  BlogPostsTable,
  type BlogPostRow,
} from '../../_components/blog-posts-table';

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
          <h1 className="text-foreground text-2xl font-bold">Blog</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Write and publish posts for the marketing site&apos;s /blog.
          </p>
        </div>
        <Link
          href="/admin/blog/editor"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-colors"
        >
          <PenSquare className="size-4" />
          New post
        </Link>
      </div>

      <BlogPostsTable posts={posts} />
    </div>
  );
}
