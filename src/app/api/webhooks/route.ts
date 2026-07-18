import { NextResponse } from 'next/server';
import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { encrypt } from '@/lib/whatsapp/encryption';
import { isWebhookEvent } from '@/lib/webhooks/events';
import { generateWebhookSecret, isAllowedWebhookUrl } from '@/lib/webhooks/security';

/**
 * GET /api/webhooks — list the account's endpoints (any member). The
 * signing secret is never included here; reveal it via /[id]/secret.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const { data, error } = await supabase
      .from('webhook_endpoints')
      .select('id, name, url, events, is_active, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[webhooks GET] error:', error);
      return NextResponse.json({ error: 'Failed to load webhooks' }, { status: 500 });
    }
    return NextResponse.json({ endpoints: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/webhooks (admin+) — create an endpoint. Generates a signing
 * secret (returned in plaintext ONCE) and stores it encrypted.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin');
    const limit = checkRateLimit(`webhooks:${userId}`, RATE_LIMITS.adminAction);
    if (!limit.success) return rateLimitResponse(limit);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!isAllowedWebhookUrl(url)) {
      return NextResponse.json(
        { error: 'URL must be a public https address.' },
        { status: 400 },
      );
    }

    const name =
      typeof body.name === 'string' && body.name.trim()
        ? body.name.trim().slice(0, 80)
        : 'Webhook';

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

    const secret = generateWebhookSecret();

    const { data, error } = await supabase
      .from('webhook_endpoints')
      .insert({
        account_id: accountId,
        created_by: userId,
        name,
        url,
        secret: encrypt(secret),
        events,
        is_active: body.is_active !== false,
      })
      .select('id, name, url, events, is_active, created_at')
      .single();

    if (error) {
      console.error('[webhooks POST] error:', error);
      return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
    }
    // Secret returned once so the caller can copy it; it's stored encrypted.
    return NextResponse.json({ endpoint: data, secret });
  } catch (err) {
    return toErrorResponse(err);
  }
}
