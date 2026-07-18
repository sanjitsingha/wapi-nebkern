import { NextResponse } from 'next/server';
import { getAdminUser } from '../../_lib/auth';
import { adminDb } from '../../_lib/admin-db';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Send an announcement. Admin-only.
 *
 * Body: { title, body, href?, audience ('all'|'account'), account_id?,
 * expires_at? }. A global ('all') announcement reaches every tenant's
 * bell; an 'account' one targets a single workspace.
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

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > 140) {
    return NextResponse.json(
      { error: 'title is required (max 140 chars)' },
      { status: 400 },
    );
  }

  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text || text.length > 1000) {
    return NextResponse.json(
      { error: 'body is required (max 1000 chars)' },
      { status: 400 },
    );
  }

  const audience = body.audience === 'account' ? 'account' : 'all';

  let accountId: string | null = null;
  if (audience === 'account') {
    if (typeof body.account_id !== 'string' || !UUID_RE.test(body.account_id)) {
      return NextResponse.json(
        { error: 'account_id is required for a targeted announcement' },
        { status: 400 },
      );
    }
    accountId = body.account_id;
  }

  const row: Record<string, unknown> = {
    title,
    body: text,
    audience,
    account_id: accountId,
    created_by: admin.id,
  };

  if (typeof body.href === 'string' && body.href.trim()) {
    // Allow a same-app path (/…) or an absolute http(s) URL (external
    // link). Reject protocol-relative (//) and anything else — that's the
    // open-redirect / javascript: guard.
    const href = body.href.trim();
    const ok =
      (href.startsWith('/') && !href.startsWith('//')) ||
      /^https?:\/\/.+/i.test(href);
    if (!ok) {
      return NextResponse.json(
        { error: 'Link must be a path starting with "/" or an http(s) URL' },
        { status: 400 },
      );
    }
    row.href = href;
  }

  if (typeof body.image_url === 'string' && body.image_url.trim()) {
    const img = body.image_url.trim();
    const ok =
      (img.startsWith('/') && !img.startsWith('//')) ||
      /^https?:\/\/.+/i.test(img);
    if (!ok) {
      return NextResponse.json(
        { error: 'Image URL must be a path starting with "/" or an http(s) URL' },
        { status: 400 },
      );
    }
    row.image_url = img;
  }

  if ('expires_at' in body) {
    const v = body.expires_at;
    if (v === null || v === '') {
      row.expires_at = null;
    } else if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) {
      row.expires_at = v;
    } else {
      return NextResponse.json({ error: 'Invalid expires_at' }, { status: 400 });
    }
  }

  const { data, error } = await adminDb()
    .from('admin_notifications')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ notification: data });
}
