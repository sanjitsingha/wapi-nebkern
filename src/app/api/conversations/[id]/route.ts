// ============================================================
// DELETE /api/conversations/[id]
//
// Delete a chat for good: the conversation row and every message in it.
// Agent+. The contact is NOT deleted, and neither is its team thread —
// that hangs off the contact, not the chat. The next message to or from
// the same number starts a new, empty conversation.
//
// This used to delete through the caller's RLS client and answer
// { ok: true } without checking that anything went. RLS does not error
// on a delete it refuses — it deletes nothing — so the chat left the
// list, came back on the next load with its whole history, and the user
// had already been told "Chat deleted". Now the role is checked here,
// the writes run service-role, and success means the row is gone.
// ============================================================

import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { logAudit } from '@/lib/audit/log';
import { AUDIT } from '@/lib/audit/events';
import { supabaseAdmin } from '@/lib/inbox/admin-client';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // Below agent this throws, and toErrorResponse turns it into a 403
    // the dialog shows — rather than a delete that quietly does nothing.
    const { supabase, accountId, userId } = await requireRole('agent');

    // Ownership check on the caller's own client. The writes below are
    // service-role and bypass RLS, so this lookup is the tenancy boundary.
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, contact:contacts(name, phone)')
      .eq('id', id)
      .eq('account_id', accountId)
      .maybeSingle();
    if (!conv) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 },
      );
    }

    const admin = supabaseAdmin();

    // Deals keep their record and just stop pointing here —
    // deals.conversation_id has no ON DELETE action and would block it.
    const { error: dealsError } = await admin
      .from('deals')
      .update({ conversation_id: null })
      .eq('conversation_id', id);
    if (dealsError) return failed('detach deals', dealsError);

    // Messages are deleted explicitly rather than left to ON DELETE
    // CASCADE, so a database whose constraint has drifted still loses
    // the history. Reactions cascade from the messages.
    const { error: messagesError, count: messagesDeleted } = await admin
      .from('messages')
      .delete({ count: 'exact' })
      .eq('conversation_id', id);
    if (messagesError) return failed('delete messages', messagesError);

    const { data: deleted, error } = await admin
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId)
      .select('id');
    if (error || !deleted?.length) {
      return failed('delete conversation', error ?? 'no row deleted');
    }

    const contact = (
      conv as unknown as {
        contact: { name: string | null; phone: string | null } | null;
      }
    ).contact;
    await logAudit({
      accountId,
      actorUserId: userId,
      action: AUDIT.CONVERSATION_DELETED,
      targetType: 'conversation',
      targetId: id,
      targetLabel: contact?.name || contact?.phone || null,
      metadata: { messages_deleted: messagesDeleted ?? 0 },
      request,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

function failed(step: string, error: unknown) {
  console.error(`[conversations DELETE] ${step} failed:`, error);
  return NextResponse.json(
    { error: 'Could not delete this chat.' },
    { status: 500 },
  );
}
