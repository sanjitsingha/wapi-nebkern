import { supabaseAdmin } from '@/lib/flows/admin-client'
import { engineSendText } from '@/lib/flows/meta-send'
import { matchesKeywordTrigger } from '@/lib/automations/engine'
import type { KeywordMatchTriggerConfig } from '@/types'
import { loadAiConfig } from './config'
import { buildConversationContext } from './context'
import { retrieveKnowledge } from './knowledge'
import { generateReply } from './generate'
import { buildSystemPrompt } from './defaults'
import { latestUserMessage } from './query'

interface DispatchArgs {
  /** Tenancy key — drives config, contact, and conversation lookups. */
  accountId: string
  conversationId: string
  contactId: string
  /** The account's WhatsApp config owner, used for the outbound send's
   *  audit columns (mirrors how the flow runner passes it through). */
  configOwnerUserId: string
  /** The just-arrived inbound message text — used to decide whether a
   *  keyword automation would actually fire for THIS message. */
  messageText: string
}

/**
 * AI auto-reply for a freshly-arrived inbound message.
 *
 * Invoked from the WhatsApp webhook, only when no deterministic flow
 * consumed the message (flows win). Mirrors the flow runner's contract:
 * it owns its try/catch and NEVER throws — a failing or slow LLM call
 * must not affect the webhook's 200 to Meta.
 *
 * Eligibility gates (any → silent no-op):
 *   - AI off / auto-reply disabled for the account
 *   - an active message-level automation exists (avoid double-texting)
 *   - a human agent is assigned (they own the thread)
 *   - auto-reply was disabled for this conversation (prior handoff)
 *   - the per-conversation reply cap is reached
 *   - there's nothing to reply to
 *
 * The 24h WhatsApp session window is inherently open here — we're
 * reacting to a customer message that just landed — so no separate
 * window check is needed.
 */
export async function dispatchInboundToAiReply(
  args: DispatchArgs,
): Promise<void> {
  const { accountId, conversationId, contactId, configOwnerUserId, messageText } =
    args

  try {
    const db = supabaseAdmin()

    // Master switch (`is_active`) governs everything, including
    // per-chat assignments — loadAiConfig returns null when it's off.
    const config = await loadAiConfig(db, accountId)
    if (!config) return

    const { data: conv, error: convErr } = await db
      .from('conversations')
      .select(
        'assigned_agent_id, ai_autoreply_disabled, ai_reply_count, ai_agent_assigned',
      )
      .eq('id', conversationId)
      .maybeSingle()
    if (convErr || !conv) return

    // Per-chat assignment is the explicit "the AI owns this thread"
    // override: it works even when the account-wide auto-reply toggle is
    // off, and skips the per-conversation cap + sticky-mute gates below.
    const aiAssigned = conv.ai_agent_assigned === true
    if (!aiAssigned && !config.autoReplyEnabled) return

    // Deterministic, user-configured responders win over the LLM — the
    // caller already excludes messages a Flow consumed. Message-level
    // automations are dispatched independently for this same inbound and
    // may send their own reply, so we stand down to avoid double-texting.
    // But be precise about WHICH automation would actually fire:
    //   - a `new_message_received` automation replies to every message
    //     → always stand down;
    //   - a `keyword_match` automation only fires when THIS message
    //     contains its keyword → stand down only on an actual match,
    //     so the bot still handles all the non-keyword traffic.
    // (Relationship triggers like `first_inbound_message` don't count —
    // they're not per-message auto-responders.)
    const { data: autoResponders } = await db
      .from('automations')
      .select('trigger_type, trigger_config')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .in('trigger_type', ['new_message_received', 'keyword_match'])
    const anAutomationWillFire = (autoResponders ?? []).some((a) =>
      a.trigger_type === 'new_message_received'
        ? true
        : matchesKeywordTrigger(
            a.trigger_config as KeywordMatchTriggerConfig,
            messageText,
          ),
    )
    if (anAutomationWillFire) return

    if (conv.assigned_agent_id) return // a human owns this thread
    if (!aiAssigned) {
      if (conv.ai_autoreply_disabled) return // handed off / turned off here
      // Cheap early-out; the authoritative cap check is the atomic claim
      // below (this read can race a concurrent inbound).
      if (conv.ai_reply_count >= config.autoReplyMaxPerConversation) return
    }

    const messages = await buildConversationContext(db, conversationId)
    if (messages.length === 0) return

    // Ground the reply in the account's knowledge base (best-effort).
    const knowledge = await retrieveKnowledge(
      db,
      accountId,
      config,
      latestUserMessage(messages),
    )

    const systemPrompt = buildSystemPrompt({
      userPrompt: config.systemPrompt,
      mode: 'auto_reply',
      knowledge,
    })

    const { text, handoff } = await generateReply({
      config,
      systemPrompt,
      messages,
    })

    if (handoff || !text) {
      // The model can't (or shouldn't) answer — stop auto-replying on
      // this thread and leave the inbound unanswered so it surfaces in
      // the inbox for a human. Sticky until an admin re-enables. An
      // assigned AI resigns its assignment too, so the conversation
      // shows as unassigned and a teammate knows to pick it up.
      await db
        .from('conversations')
        .update({ ai_autoreply_disabled: true, ai_agent_assigned: false })
        .eq('id', conversationId)
      return
    }

    // Atomically claim a reply slot: the cap check + increment happen in
    // one UPDATE, so concurrent inbounds can never overshoot the cap. If
    // another inbound just took the last slot, `claimed` is false and we
    // skip the send. (We consume a slot slightly before the send lands —
    // fail-safe: under-reply rather than over-reply.)
    //
    // Assigned mode has no cap, but still claims with an effectively
    // unbounded max so `ai_reply_count` keeps counting for visibility.
    const { data: claimed, error: claimErr } = await db.rpc(
      'claim_ai_reply_slot',
      {
        conversation_id: conversationId,
        max_replies: aiAssigned ? 2147483647 : config.autoReplyMaxPerConversation,
      },
    )
    if (claimErr || claimed !== true) return

    await engineSendText({
      accountId,
      userId: configOwnerUserId,
      conversationId,
      contactId,
      text,
    })
  } catch (err) {
    console.error('[ai auto-reply] dispatch failed:', err)
  }
}
