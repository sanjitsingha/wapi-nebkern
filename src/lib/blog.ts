// ============================================================
// Public marketing-site data access (blog posts, live pricing).
//
// Server-side only. Uses a plain anon-key client — no cookies, no
// session — because these surfaces are public: RLS lets anon read
// published blog_posts and active billing_plans.
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function publicDb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

export interface BlogPostMeta {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  authorName: string | null;
  tags: string[];
  publishedAt: string | null;
}

export interface BlogPost extends BlogPostMeta {
  contentHtml: string;
}

interface PostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html?: string;
  cover_image_url: string | null;
  author_name: string | null;
  tags: unknown;
  published_at: string | null;
}

function mapMeta(r: PostRow): BlogPostMeta {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    coverImageUrl: r.cover_image_url,
    authorName: r.author_name,
    tags: Array.isArray(r.tags)
      ? (r.tags.filter((t) => typeof t === 'string') as string[])
      : [],
    publishedAt: r.published_at,
  };
}

/** Published posts, newest first (RLS hides drafts from anon). */
export async function getPublishedPosts(limit = 50): Promise<BlogPostMeta[]> {
  const { data } = await publicDb()
    .from('blog_posts')
    .select(
      'id, slug, title, excerpt, cover_image_url, author_name, tags, published_at',
    )
    .order('published_at', { ascending: false })
    .limit(limit);
  return ((data ?? []) as PostRow[]).map(mapMeta);
}

/** One published post by slug, or null. */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const { data } = await publicDb()
    .from('blog_posts')
    .select(
      'id, slug, title, excerpt, content_html, cover_image_url, author_name, tags, published_at',
    )
    .eq('slug', slug)
    .maybeSingle();
  if (!data) return null;
  const row = data as PostRow;
  return { ...mapMeta(row), contentHtml: row.content_html ?? '' };
}

/** Rough reading time from HTML content (~200 wpm, min 1). */
export function readMinutes(html: string): number {
  const words = html
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Long date for bylines, e.g. "July 19, 2026". */
export function formatPostDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
