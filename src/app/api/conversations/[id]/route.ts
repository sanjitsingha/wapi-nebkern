// ============================================================
// DELETE /api/conversations/[id]
//
// Delete a conversation and its messages. Agent+ (RLS: conversations_delete
// = is_account_member(account_id, 'agent')). messages / message_actions
// cascade; deals.conversation_id has no cascade, so it's detached first.
// The contact itself is NOT deleted.
// ============================================================

import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, accountId } = await getCurrentAccount();

    // Confirm it exists and is visible to the caller (RLS scopes to account).
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', id)
      .eq('account_id', accountId)
      .maybeSingle();
    if (!conv) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 },
      );
    }

    // Detach any deals linked to this conversation (no ON DELETE cascade).
    await supabase
      .from('deals')
      .update({ conversation_id: null })
      .eq('conversation_id', id);

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);
    if (error) {
      console.error('[conversations DELETE] failed:', error);
      return NextResponse.json(
        { error: 'Could not delete this chat.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
