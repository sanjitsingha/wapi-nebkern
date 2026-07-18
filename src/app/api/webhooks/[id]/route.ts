import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { isWebhookEvent } from '@/lib/webhooks/events';
import { isAllowedWebhookUrl } from '@/lib/webhooks/security';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST /api/webhooks/[id] (admin+) — update name/url/events/is_active. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, accountId } = await requireRole('admin');
    const { id } = await context.params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const update: Record<string, unknown> = {};

    if ('name' in body) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
      }
      update.name = body.name.trim().slice(0, 80);
    }
    if ('url' in body) {
      if (typeof body.url !== 'string' || !isAllowedWebhookUrl(body.url.trim())) {
        return NextResponse.json(
          { error: 'URL must be a public https address.' },
          { status: 400 },
        );
      }
      update.url = body.url.trim();
    }
    if ('events' in body) {
      const events = Array.isArray(body.events)
        ? [...new Set(body.events)].filter(
            (e): e is string => typeof e === 'string' && isWebhookEvent(e),
          )
        : [];
      if (events.length === 0) {
        return NextResponse.json(
          { error: 'Select at least one event.' },
          { status: 400 },
        );
      }
      update.events = events;
    }
    if ('is_active' in body) {
      if (typeof body.is_active !== 'boolean') {
        return NextResponse.json({ error: 'Invalid is_active' }, { status: 400 });
      }
      update.is_active = body.is_active;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('webhook_endpoints')
      .update(update)
      .eq('id', id)
      .eq('account_id', accountId)
      .select('id, name, url, events, is_active, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 });
    }
    return NextResponse.json({ endpoint: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** DELETE /api/webhooks/[id] (admin+). */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, accountId } = await requireRole('admin');
    const { id } = await context.params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }
    const { error } = await supabase
      .from('webhook_endpoints')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);
    if (error) {
      return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
