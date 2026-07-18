import { NextResponse } from 'next/server';
import { getAdminUser } from '../../_lib/auth';
import { adminDb } from '../../_lib/admin-db';
import { isAllowedUrl } from '@/lib/app-popup';
import { isAnnouncementVariant } from '@/lib/app-announcement';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

/**
 * Create an announcement bar. Admin-only.
 *
 * Requires `message`. Optional link (link_url + link_label), a `variant`
 * for severity styling (info/success/warning/critical), and `dismissible`.
 * Audience 'all' (global) or 'account' (targeted).
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

  const message = str(body.message, 400);
  if (!message) {
    return NextResponse.json({ error: 'A message is required.' }, { status: 400 });
  }

  const linkUrl = str(body.link_url, 2000);
  const linkLabel = str(body.link_label, 60);
  if (linkUrl && !isAllowedUrl(linkUrl)) {
    return NextResponse.json(
      { error: 'Link must be a path starting with "/" or an http(s) URL' },
      { status: 400 },
    );
  }

  const variant = isAnnouncementVariant(body.variant) ? body.variant : 'info';
  const dismissible = body.dismissible !== false;

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
    message,
    link_url: linkUrl,
    link_label: linkUrl ? linkLabel : null,
    variant,
    dismissible,
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
    .from('app_announcements')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ announcement: data });
}
