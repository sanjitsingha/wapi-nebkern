import Link from 'next/link';
import { PenSquare } from 'lucide-react';

import { adminDb } from '../../_lib/admin-db';
import { ADMIN_TAGS, cachedRead } from '../../_lib/admin-cache';
import {
  BlogPostsTable,
  type BlogPostRow,
} from '../../_components/blog-posts-table';
import { CacheNote, PageHeader } from '../../_components/ui';

export const dynamic = 'force-dynamic';

const getPosts = () =>
  cachedRead(ADMIN_TAGS.blog, ['list'], async () => {
    const { data } = await adminDb()
      .from('blog_posts')
      .select('id, slug, title, excerpt, status, tags, published_at, updated_at')
      .order('updated_at', { ascending: false });

    return (data ?? []) as BlogPostRow[];
  });

export default async function AdminBlogPage() {
  const posts = await getPosts();
  const published = posts.filter((p) => p.status === 'published').length;

  return (
    <>
      <PageHeader
        title="Blog"
        description="Write and publish posts for the marketing site's /blog."
        meta={
          <>
            <CacheNote />
            <span>·</span>
            <span>{published} published</span>
            <span>·</span>
            <span>{posts.length - published} drafts</span>
          </>
        }
      >
        <Link
          href="/admin/blog/editor"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm px-3 text-xs font-semibold transition-colors"
        >
          <PenSquare className="size-3.5" />
          New post
        </Link>
      </PageHeader>

      <BlogPostsTable posts={posts} />
    </>
  );
}
