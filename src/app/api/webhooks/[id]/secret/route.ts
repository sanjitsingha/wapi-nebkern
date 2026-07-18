import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { decrypt } from '@/lib/whatsapp/encryption';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/webhooks/[id]/secret (admin+) — reveal the signing secret so
 * the account can configure signature verification on their receiver.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, accountId } = await requireRole('admin');
    const { id } = await context.params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('webhook_endpoints')
      .select('secret')
      .eq('id', id)
      .eq('account_id', accountId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    try {
      return NextResponse.json({ secret: decrypt(data.secret) });
    } catch {
      return NextResponse.json(
        { error: 'Secret could not be decrypted (check ENCRYPTION_KEY).' },
        { status: 500 },
      );
    }
  } catch (err) {
    return toErrorResponse(err);
  }
}
