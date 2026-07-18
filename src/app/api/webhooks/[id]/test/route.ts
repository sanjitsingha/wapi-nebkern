import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { decrypt } from '@/lib/whatsapp/encryption';
import { deliverOne } from '@/lib/webhooks/dispatch';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/webhooks/[id]/test (admin+) — send a signed `webhook.test`
 * event to the endpoint right now (bypassing the queue) and report the
 * result, so the account can confirm their receiver works.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin');
    const limit = checkRateLimit(`webhook-test:${userId}`, RATE_LIMITS.adminAction);
    if (!limit.success) return rateLimitResponse(limit);

    const { id } = await context.params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('webhook_endpoints')
      .select('url, secret')
      .eq('id', id)
      .eq('account_id', accountId)
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    let secret: string;
    try {
      secret = decrypt(data.secret);
    } catch {
      return NextResponse.json(
        { error: 'Secret could not be decrypted.' },
        { status: 500 },
      );
    }

    const result = await deliverOne(data.url, secret, {
      id: `test_${Date.now()}`,
      event: 'webhook.test',
      created_at: new Date().toISOString(),
      account_id: accountId,
      data: { message: 'This is a test event from wacrm.' },
    });

    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
