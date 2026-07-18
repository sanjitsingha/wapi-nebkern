import { NextResponse } from 'next/server';
import { getAdminUser } from '../../_lib/auth';
import { adminDb } from '../../_lib/admin-db';
import { isAllowedUrl, youtubeId } from '@/lib/app-popup';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

/**
 * Create an app splash popup. Admin-only.
 *
 * Any combination of { title, body, image_url, youtube_url, link_url +
 * link_label } — must carry at least one of title/body/image/video (the
 * DB enforces this too). Audience 'all' (global) or 'account' (targeted).
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

  const title = str(body.title, 140);
  const text = str(body.body, 2000);
  const imageUrl = str(body.image_url, 2000);
  const youtubeUrl = str(body.youtube_url, 2000);
  const linkUrl = str(body.link_url, 2000);
  const linkLabel = str(body.link_label, 60);

  if (!title && !text && !imageUrl && !youtubeUrl) {
    return NextResponse.json(
      { error: 'Add a title, message, image, or video.' },
      { status: 400 },
    );
  }
  if (imageUrl && !isAllowedUrl(imageUrl)) {
    return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
  }
  if (youtubeUrl && !youtubeId(youtubeUrl)) {
    return NextResponse.json(
      { error: "That doesn't look like a YouTube link" },
      { status: 400 },
    );
  }
  if (linkUrl && !isAllowedUrl(linkUrl)) {
    return NextResponse.json(
      { error: 'Link must be a path starting with "/" or an http(s) URL' },
      { status: 400 },
    );
  }

  const audience = body.audience === 'account' ? 'account' : 'all';
  let accountId: string | null = null;
  if (audience === 'account') {
    if (typeof body.account_id !== 'string' || !UUID_RE.test(body.account_id)) {
      return NextResponse.json(
        { error: 'Pick an account to target' },
        { status: 400 },
      );
    }
    accountId = body.account_id;
  }

  const row: Record<string, unknown> = {
    title,
    body: text,
    image_url: imageUrl,
    youtube_url: youtubeUrl,
    link_url: linkUrl,
    link_label: linkUrl ? linkLabel : null,
    audience,
    account_id: accountId,
    created_by: admin.id,
  };

  for (const field of ['starts_at', 'expires_at'] as const) {
    const v = body[field];
    if (v === null || v === '' || v === undefined) {
      row[field] = null;
    } else if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) {
      row[field] = v;
    } else {
      return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
    }
  }

  const { data, error } = await adminDb()
    .from('app_popups')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ popup: data });
}
