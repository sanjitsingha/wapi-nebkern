import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { emitWebhookEvent } from '@/lib/webhooks/emit';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/contacts/notify-created
 *
 * Fires the `contact.created` webhook for a contact the browser just
 * created (the add-contact form inserts directly via the RLS client, so
 * there's no server insert to hook). We verify the contact exists in the
 * caller's account before emitting — so this can't be used to forge an
 * event for a contact that isn't theirs.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const body = await request.json().catch(() => null);
    const id = typeof body?.contact_id === 'string' ? body.contact_id : '';
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid contact_id' }, { status: 400 });
    }

    const { data: contact } = await supabase
      .from('contacts')
      .select('id, name, phone')
      .eq('id', id)
      .eq('account_id', accountId)
      .maybeSingle();
    if (!contact) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    await emitWebhookEvent(accountId, 'contact.created', {
      contact_id: contact.id,
      name: contact.name,
      phone: contact.phone,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
