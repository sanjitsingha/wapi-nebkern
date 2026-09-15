// ============================================================
// DELETE /api/conversations/[id]
//
// Delete a chat for good: the conversation row, every message in it, and
// the contact's Team Inbox thread (its messages and their @mentions).
// Agent+. The contact itself is NOT deleted. The next message to or from
// the same number starts a new, empty conversation and an empty thread.
//
// The team thread goes with the chat because a contact has exactly one
// conversation (UNIQUE(account_id, contact_id), migration 027) — the
// thread is the team's talk about that chat, and keeping it after the
// chat was deleted left history the user had just asked to remove. The
// rows are hard-deleted, unlike a single thread message's soft delete:
// this is the whole record going, not one comment being retracted.
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
      .select('id, contact_id, contact:contacts(name, phone)')
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

    // The Team Inbox thread. Mentions first and explicitly, for the same
    // reason as messages above — they would cascade from the thread
    // messages, but a leftover mention is a bell notification pointing
    // at a thread that no longer exists.
    let teamMessagesDeleted = 0;
    if (conv.contact_id) {
      const { error: mentionsError } = await admin
        .from('contact_thread_mentions')
        .delete()
        .eq('account_id', accountId)
        .eq('contact_id', conv.contact_id);
      if (mentionsError) return failed('delete team mentions', mentionsError);

      const { error: threadError, count } = await admin
        .from('contact_thread_messages')
        .delete({ count: 'exact' })
        .eq('account_id', accountId)
        .eq('contact_id', conv.contact_id);
      if (threadError) return failed('delete team thread', threadError);
      teamMessagesDeleted = count ?? 0;
    }

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
      metadata: {
        messages_deleted: messagesDeleted ?? 0,
        team_messages_deleted: teamMessagesDeleted,
      },
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
