import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import {
  startFlowForConversation,
  stopFlowForContact,
} from '@/lib/flows/engine';
import { emitWebhookEvent } from '@/lib/webhooks/emit';

/**
 * POST /api/conversations/[id]/assign
 *
 * Single entry point for changing a conversation's assignee from the
 * inbox. Handles four cases and keeps the bot lifecycle in sync:
 *
 *   { type: 'agent', agentId } → hand to a human; stop any active bot
 *   { type: 'flow',  flowId }  → hand to a Flow (bot); start its run
 *   { type: 'ai' }             → hand to the AI agent; stop any flow
 *   { type: 'none' }           → unassign; stop any active bot
 *
 * `assigned_agent_id`, `assigned_flow_id`, and `ai_agent_assigned` are
 * kept mutually exclusive: assigning one clears the others.
 */

type Body =
  | { type: 'agent'; agentId: string }
  | { type: 'flow'; flowId: string }
  | { type: 'ai' }
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
        .update({
          assigned_flow_id: body.flowId,
          assigned_agent_id: null,
          ai_agent_assigned: false,
        })
        .eq('id', conversationId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        assigned_flow_id: body.flowId,
        assigned_agent_id: null,
        ai_agent_assigned: false,
      });
    }

    if (body.type === 'ai') {
      // Reject with an actionable message when the AI isn't usable —
      // mirrors the flow path's "don't assign what can't run" rule. The
      // master switch must be on; the account-wide auto-reply toggle is
      // NOT required (per-chat assignment is the explicit override).
      const { data: aiConfig } = await supabase
        .from('ai_configs')
        .select('is_active')
        .eq('account_id', accountId)
        .maybeSingle();
      if (!aiConfig) {
        return NextResponse.json(
          { error: 'No AI agent configured yet — set one up under AI Agents.' },
          { status: 400 },
        );
      }
      if (!aiConfig.is_active) {
        return NextResponse.json(
          {
            error:
              'The AI assistant is turned off. Enable it under AI Agents → Setup first.',
          },
          { status: 400 },
        );
      }

      // The AI replaces any flow currently driving the chat.
      await stopFlowForContact({ accountId, contactId });

      const { error } = await supabase
        .from('conversations')
        .update({
          ai_agent_assigned: true,
          assigned_agent_id: null,
          assigned_flow_id: null,
          // A previously handed-off / capped thread is explicitly being
          // re-handed to the AI — clear the sticky mute so it can speak.
          ai_autoreply_disabled: false,
        })
        .eq('id', conversationId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        assigned_agent_id: null,
        assigned_flow_id: null,
        ai_agent_assigned: true,
      });
    }

    // 'agent' or 'none' — both stop any bot currently driving the chat.
    await stopFlowForContact({ accountId, contactId });

    const assigned_agent_id = body.type === 'agent' ? body.agentId : null;
    const { error } = await supabase
      .from('conversations')
      .update({
        assigned_agent_id,
        assigned_flow_id: null,
        ai_agent_assigned: false,
      })
      .eq('id', conversationId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Outbound webhook: only when handed to a human agent (not on unassign).
    if (assigned_agent_id) {
      await emitWebhookEvent(accountId, 'conversation.assigned', {
        conversation_id: conversationId,
        contact_id: contactId,
        agent_id: assigned_agent_id,
      });
    }

    return NextResponse.json({
      ok: true,
      assigned_agent_id,
      assigned_flow_id: null,
      ai_agent_assigned: false,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
