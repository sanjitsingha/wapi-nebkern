import { NextResponse } from 'next/server';
import { getAdminUser } from '../../_lib/auth';
import { adminDb } from '../../_lib/admin-db';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function str(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

function parseTags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
}

/**
 * Create a blog post (admin-only). Requires title + slug; content and
 * everything else can be filled in later — posts start as drafts unless
 * status:'published' is sent.
 */
export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const title = str(body.title, 200);
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json(
      { error: 'Slug must be lowercase letters, numbers and hyphens' },
      { status: 400 },
    );
  }

  const status = body.status === 'published' ? 'published' : 'draft';

  const row = {
    slug,
    title,
    excerpt: str(body.excerpt, 400),
    content_html: typeof body.content_html === 'string' ? body.content_html : '',
    cover_image_url: str(body.cover_image_url, 2000),
    author_name: str(body.author_name, 80),
    tags: parseTags(body.tags),
    status,
    published_at: status === 'published' ? new Date().toISOString() : null,
    created_by: admin.id,
  };

  const { data, error } = await adminDb()
    .from('blog_posts')
    .insert(row)
    .select('id, slug')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `A post with slug "${slug}" already exists` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ post: data });
}
