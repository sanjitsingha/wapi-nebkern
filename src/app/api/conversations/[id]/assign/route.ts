import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import {
  startFlowForConversation,
  stopFlowForContact,
} from '@/lib/flows/engine';

/**
 * POST /api/conversations/[id]/assign
 *
 * Single entry point for changing a conversation's assignee from the
 * inbox. Handles three cases and keeps the bot lifecycle in sync:
 *
 *   { type: 'agent', agentId } → hand to a human; stop any active bot
 *   { type: 'flow',  flowId }  → hand to a Flow (bot); start its run
 *   { type: 'none' }           → unassign; stop any active bot
 *
 * `assigned_agent_id` and `assigned_flow_id` are kept mutually
 * exclusive: assigning one clears the other.
 */

type Body =
  | { type: 'agent'; agentId: string }
  | { type: 'flow'; flowId: string }
  | { type: 'none' };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: conversationId } = await params;
    const { supabase, accountId } = await getCurrentAccount();

    const body = (await request.json()) as Body;

    // Verify the conversation exists and is visible to the caller (RLS
    // scopes to their account) and grab the contact it belongs to.
    const { data: conversation, error: convErr } = await supabase
      .from('conversations')
      .select('id, contact_id')
      .eq('id', conversationId)
      .maybeSingle();
    if (convErr || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 },
      );
    }
    const contactId = conversation.contact_id as string;

    if (body.type === 'flow') {
      // Start the bot first — if it can't run (missing/invalid/inactive
      // flow), we don't touch the assignment so the UI stays truthful.
      const started = await startFlowForConversation({
        accountId,
        flowId: body.flowId,
        contactId,
        conversationId,
      });
      if (!started.ok) {
        return NextResponse.json(
          { error: started.error ?? 'Failed to start bot' },
          { status: 400 },
        );
      }
      const { error } = await supabase
        .from('conversations')
        .update({ assigned_flow_id: body.flowId, assigned_agent_id: null })
        .eq('id', conversationId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        assigned_flow_id: body.flowId,
        assigned_agent_id: null,
      });
    }

    // 'agent' or 'none' — both stop any bot currently driving the chat.
    await stopFlowForContact({ accountId, contactId });

    const assigned_agent_id = body.type === 'agent' ? body.agentId : null;
    const { error } = await supabase
      .from('conversations')
      .update({ assigned_agent_id, assigned_flow_id: null })
      .eq('id', conversationId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      assigned_agent_id,
      assigned_flow_id: null,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
