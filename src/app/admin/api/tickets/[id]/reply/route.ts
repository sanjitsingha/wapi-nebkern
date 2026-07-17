import { NextResponse } from 'next/server';
import { getAdminUser } from '../../../../_lib/auth';
import { adminDb } from '../../../../_lib/admin-db';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Post a support (product-team) reply to a ticket. Admin-only. Inserts a
 * message with author_role='support' via the service role — the only way
 * such a row can be created (the tenant RLS insert policy forbids it). The
 * touch trigger then advances last_support_reply_at, which lights the
 * customer's sidebar unread dot.
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
    return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!text) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }
  if (text.length > 8000) {
    return NextResponse.json({ error: 'Message too long' }, { status: 400 });
  }

  const db = adminDb();

  // Resolve the ticket's account_id (denormalized onto messages).
  const { data: ticket, error: ticketErr } = await db
    .from('support_tickets')
    .select('id, account_id, status')
    .eq('id', id)
    .maybeSingle();
  if (ticketErr) {
    return NextResponse.json({ error: ticketErr.message }, { status: 500 });
  }
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const { data: message, error: msgErr } = await db
    .from('support_ticket_messages')
    .insert({
      ticket_id: ticket.id,
      account_id: ticket.account_id,
      author_role: 'support',
      user_id: null,
      body: text,
    })
    .select()
    .single();
  if (msgErr) {
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  // Replying moves an 'open' ticket to 'pending' (awaiting the customer).
  if (ticket.status === 'open') {
    await db
      .from('support_tickets')
      .update({ status: 'pending' })
      .eq('id', ticket.id);
  }

  return NextResponse.json({ message });
}
