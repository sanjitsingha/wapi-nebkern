import { NextResponse } from 'next/server';
import { getAdminUser } from '../../../_lib/auth';
import { adminDb } from '../../../_lib/admin-db';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Update a blog post (admin-only). Accepts any subset of the editable
 * fields. Publishing for the first time stamps published_at; reverting
 * to draft clears it so a later re-publish gets a fresh date.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if ('title' in body) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'Invalid title' }, { status: 400 });
    }
    update.title = body.title.trim().slice(0, 200);
  }

  if ('slug' in body) {
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    if (!SLUG_RE.test(slug)) {
      return NextResponse.json(
        { error: 'Slug must be lowercase letters, numbers and hyphens' },
        { status: 400 },
      );
    }
    update.slug = slug;
  }

  for (const [key, max] of [
    ['excerpt', 400],
    ['cover_image_url', 2000],
    ['author_name', 80],
  ] as const) {
    if (key in body) {
      const v = body[key];
      if (v === null || v === '') update[key] = null;
      else if (typeof v === 'string') update[key] = v.trim().slice(0, max) || null;
      else return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
    }
  }

  if ('content_html' in body) {
    if (typeof body.content_html !== 'string') {
      return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
    }
    update.content_html = body.content_html;
  }

  if ('tags' in body) {
    if (!Array.isArray(body.tags)) {
      return NextResponse.json({ error: 'Invalid tags' }, { status: 400 });
    }
    update.tags = body.tags
      .filter((t: unknown): t is string => typeof t === 'string')
      .map((t: string) => t.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  if ('status' in body) {
    if (body.status !== 'draft' && body.status !== 'published') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    update.status = body.status;
    if (body.status === 'published') {
      // Preserve the original publish date on re-publish edits: only
      // stamp when the row has no published_at yet.
      const { data: existing } = await adminDb()
        .from('blog_posts')
        .select('published_at')
        .eq('id', id)
        .maybeSingle();
      if (!existing?.published_at) {
        update.published_at = new Date().toISOString();
      }
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await adminDb()
    .from('blog_posts')
    .update(update)
    .eq('id', id)
    .select('id, slug, status')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'That slug is already taken' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ post: data });
}

/** Delete a post (admin-only). */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const { error } = await adminDb().from('blog_posts').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
