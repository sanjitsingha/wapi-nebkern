import { adminDb } from '../../../_lib/admin-db';
import {
  BlogEditor,
  type BlogPostRecord,
} from '../../../_components/blog-editor';

export const dynamic = 'force-dynamic';

/**
 * New-post and edit-post share this page: with ?id= it loads the row
 * and passes it to the editor; without, the editor starts blank and
 * creates on first save.
 */
export default async function AdminBlogEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  let post: BlogPostRecord | null = null;
  if (id && /^[0-9a-f-]{36}$/i.test(id)) {
    const { data } = await adminDb()
      .from('blog_posts')
      .select(
        'id, slug, title, excerpt, content_html, cover_image_url, author_name, tags, status',
      )
      .eq('id', id)
      .maybeSingle();
    post = (data as BlogPostRecord | null) ?? null;
  }

  return <BlogEditor post={post} />;
}
