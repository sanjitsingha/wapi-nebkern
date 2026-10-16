import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { engineSendText } from '@/lib/flows/meta-send'
import { matchesKeywordTrigger } from '@/lib/automations/engine'
import type { KeywordMatchTriggerConfig } from '@/types'
import { AiError, type AiConfig } from './types'
import { loadAiConfig } from './config'
import { buildConversationContext } from './context'
import { retrieveKnowledge } from './knowledge'
import { generateReply, type GenerateArgs } from './generate'
import { buildSystemPrompt } from './defaults'
import { latestUserMessage } from './query'
import { shouldActivate } from './activation'
import { RESPONSE_DELAY, SNOOZE, isWithinOperatingHours } from './reply-settings'

// How long a conversation must go quiet (no new customer message)
// before the bot actually replies is the account's response delay
// (Maya → Configuration; RESPONSE_DELAY in reply-settings.ts). A wait up
// to IN_PROCESS_WAIT_MAX_MS is held right here, comfortably inside the
// reply-engine invocation's 60s budget (see reply-engine/route.ts); a
// longer one is left to the minute cron, which finds it by its DB
// deadline (due-replies.ts).
//
// Coalescing is done through a monotonic per-conversation sequence in
// the DB (migration 049), NOT by comparing message timestamps: each
// eligible inbound bumps the sequence and resets the deadline, and only
// the holder of the highest sequence can atomically claim the reply
// once the deadline passes. That's immune to the two things that broke
// the timestamp approach — insertion latency (several invocations
// anchoring on the same "latest" message and all replying) and
// second-granularity WhatsApp timestamps (ties with no stable order).
const IN_PROCESS_WAIT_MAX_MS = 30_000
const QUIET_POLL_INTERVAL_MS = 2_000

export interface DispatchArgs {
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
  /** Set by the minute cron for a reply whose wait ran out after this
   *  engine stopped holding it (due-replies.ts): skip the inbound gates
   *  and the wait, and claim debounce sequence `dueSeq` directly. */
  dueSeq?: number
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
 * After the gates pass it waits for the conversation to go quiet for
 * QUIET_PERIOD_MS before building context and generating, so a customer
 * sending several short messages in a row gets one reply covering all
 * of them instead of one reply per message — see waitForBurstToSettle.
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

    // A wait that outlived this engine's in-memory window, handed back by
    // the minute cron once due (due-replies.ts). The inbound gates ran
    // when the message arrived. Claim first — it clears the deadline, so
    // a chat she can't answer now isn't handed back every minute.
    if (typeof args.dueSeq === 'number') {
      if (!(await claimDebounce(db, conversationId, args.dueSeq))) return
      const config = await loadAiConfig(db, accountId)
      if (!config) return
      await replyNow({
        db,
        config,
        accountId,
        conversationId,
        contactId,
        configOwnerUserId,
        mySeq: args.dueSeq,
      })
      return
    }

    // Master switch (`is_active`) governs everything, including
    // per-chat assignments — loadAiConfig returns null when it's off.
    const config = await loadAiConfig(db, accountId)
    if (!config) return

    const conv = await loadReplyState(db, conversationId)
    if (!conv || !mayReply(conv, config)) return

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

    if (await teammateSpoke(db, conversationId, config.snoozeSeconds ?? SNOOZE.default)) return

    // Response delay: wait for the conversation to go quiet for the
    // configured time before replying — a teammate gets to answer first,
    // and a customer typing several short messages ("Hii" / "Hey" / "How
    // are you") gets ONE reply covering the burst. My `seq` is unique
    // and monotonic: every other message in the burst holds a different
    // one, and only the holder of the CURRENT (highest) seq can claim the
    // reply. If a newer message bumps past me while I wait, I stand down;
    // the latest message's invocation proceeds and reads the whole burst
    // out of the DB. No in-memory buffering — each invocation is separate.
    const delayMs = (config.responseDelaySeconds ?? RESPONSE_DELAY.default) * 1000
    const mySeq = await bumpDebounce(db, conversationId, delayMs)
    if (mySeq === null) return // conversation vanished — nothing to reply to
    // Too long to hold this invocation open: the deadline is in the DB,
    // and the minute cron claims the reply once it passes.
    if (delayMs > IN_PROCESS_WAIT_MAX_MS) return
    const stillMine = await waitForQuietPeriod(db, conversationId, mySeq, delayMs)
    if (!stillMine) return
    // Atomic: only the holder of the current seq wins, and only once the
    // deadline has elapsed. Everyone else — including ties — loses here.
    const won = await claimDebounce(db, conversationId, mySeq)
    if (!won) return

    await replyNow({
      db,
      config,
      accountId,
      conversationId,
      contactId,
      configOwnerUserId,
      mySeq,
    })
  } catch (err) {
    console.error('[ai auto-reply] dispatch failed:', err)
  }
}

interface ReplyState {
  assigned_agent_id: string | null
  ai_autoreply_disabled: boolean | null
  ai_reply_count: number
  ai_agent_assigned: boolean | null
}

async function loadReplyState(
  db: SupabaseClient,
  conversationId: string,
): Promise<ReplyState | null> {
  const { data, error } = await db
    .from('conversations')
    .select('assigned_agent_id, ai_autoreply_disabled, ai_reply_count, ai_agent_assigned')
    .eq('id', conversationId)
    .maybeSingle()
  if (error || !data) return null
  return data as ReplyState
}

/**
 * The gates that can change while she waits — checked when the message
 * arrives and again just before she replies.
 */
function mayReply(conv: ReplyState, config: AiConfig): boolean {
  // Per-chat assignment is the explicit "the AI owns this thread"
  // override: it works even when the account-wide auto-reply toggle is
  // off, and skips the per-conversation cap + sticky-mute gates below.
  const aiAssigned = conv.ai_agent_assigned === true
  if (!aiAssigned && !config.autoReplyEnabled) return false
  if (conv.assigned_agent_id) return false // a human owns this thread
  if (!aiAssigned) {
    if (conv.ai_autoreply_disabled) return false // handed off / turned off here
    // Cheap early-out; the authoritative cap check is the atomic claim
    // in replyNow (this read can race a concurrent inbound).
    if (conv.ai_reply_count >= config.autoReplyMaxPerConversation) return false
  }
  // Outside operating hours she doesn't auto-reply at all.
  return isWithinOperatingHours(config.operatingHours)
}

/**
 * Whether a teammate has spoken: replied after the customer's last
 * message (they answered while she waited — the response delay is for
 * exactly this), or within the snooze window.
 */
async function teammateSpoke(
  db: SupabaseClient,
  conversationId: string,
  snoozeSeconds: number,
): Promise<boolean> {
  const latest = async (senderType: 'agent' | 'customer') => {
    const { data } = await db
      .from('messages')
      .select('created_at')
      .eq('conversation_id', conversationId)
      .eq('sender_type', senderType)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data?.created_at ? new Date(data.created_at).getTime() : null
  }
  const [agentAt, customerAt] = await Promise.all([latest('agent'), latest('customer')])
  if (agentAt === null) return false
  if (customerAt === null || agentAt > customerAt) return true
  return snoozeSeconds > 0 && Date.now() - agentAt < snoozeSeconds * 1000
}

/**
 * Write and send the reply, once the wait is over and the debounce is
 * claimed. Re-checks everything that may have changed meanwhile — a
 * teammate took or answered the chat, the hours ended, she was turned
 * off here — then runs the activation rules, generates and sends.
 */
async function replyNow(ctx: {
  db: SupabaseClient
  config: AiConfig
  accountId: string
  conversationId: string
  contactId: string
  configOwnerUserId: string
  mySeq: number
}): Promise<void> {
  const { db, config, accountId, conversationId, contactId, configOwnerUserId, mySeq } = ctx

  const conv = await loadReplyState(db, conversationId)
  if (!conv || !mayReply(conv, config)) return
  if (await teammateSpoke(db, conversationId, config.snoozeSeconds ?? SNOOZE.default)) return
  const aiAssigned = conv.ai_agent_assigned === true

  const messages = await buildConversationContext(db, conversationId)
  if (messages.length === 0) return

  // Activation rules: one short yes/no call on the burst before the
  // real reply, so "ok" and "thanks" go unanswered. Staying quiet
  // changes nothing — no mute, no reply counted — and the check
  // fails open, so a broken one never silences her.
  if (
    config.activationPrompt &&
    !(await shouldActivate({ config, rules: config.activationPrompt, messages }))
  ) {
    console.info(
      `[ai auto-reply] activation rules: no reply needed for conversation ${conversationId}`,
    )
    return
  }

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

  const { text, handoff } = await generateWithRetry({
    config,
    systemPrompt,
    messages,
  })

  if (handoff) {
    // The model explicitly signalled it can't (or shouldn't) answer —
    // stop auto-replying on this thread and leave the inbound
    // unanswered so it surfaces in the inbox for a human. Sticky until
    // re-enabled. An assigned AI resigns its assignment too, so the
    // conversation shows as unassigned and a teammate picks it up.
    await db
      .from('conversations')
      .update({ ai_autoreply_disabled: true, ai_agent_assigned: false })
      .eq('id', conversationId)
    return
  }
  if (!text) {
    // Empty output without a handoff signal is a provider glitch
    // (reasoning models, truncation), not a decision — skip this turn
    // but do NOT mute the thread or drop the assignment.
    console.warn(
      `[ai auto-reply] empty generation for conversation ${conversationId} — skipped (state unchanged)`,
    )
    return
  }

  // Burst guard: if the customer sent ANOTHER message while we were
  // generating (after we claimed), drop this now-stale reply. That
  // message bumped the sequence past `mySeq` and started its own
  // debounce; it will answer the fuller burst with one coherent reply
  // — instead of the customer getting overlapping answers out of order.
  const currentSeq = await currentDebounceSeq(db, conversationId)
  if (currentSeq !== null && currentSeq > mySeq) return

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
}

/** Codes worth one retry — momentary provider hiccups, common on free
 *  OpenRouter tiers. Anything else (invalid key, bad model) fails fast. */
const TRANSIENT_AI_CODES = new Set([
  'timeout',
  'rate_limited',
  'network_error',
  'empty_response',
  'provider_error',
])

/** One bounded retry over `generateReply` so a single flaky provider
 *  response doesn't swallow a customer's reply. */
async function generateWithRetry(args: GenerateArgs) {
  try {
    return await generateReply(args)
  } catch (err) {
    if (!(err instanceof AiError) || !TRANSIENT_AI_CODES.has(err.code)) throw err
    console.warn(
      `[ai auto-reply] transient provider error (${err.code}) — retrying once`,
    )
    await new Promise((r) => setTimeout(r, 1500))
    return await generateReply(args)
  }
}

/** Register this inbound in the conversation's debounce sequence and
 *  (re)set the quiet-period deadline. Returns the new, unique sequence
 *  value to hold, or null if the conversation row is gone. */
async function bumpDebounce(
  db: SupabaseClient,
  conversationId: string,
  delayMs: number,
): Promise<number | null> {
  const { data, error } = await db.rpc('bump_ai_reply_debounce', {
    p_conversation_id: conversationId,
    p_delay_ms: delayMs,
  })
  if (error || data == null) return null
  return Number(data)
}

/** Current (highest) debounce sequence for a conversation, or null. */
async function currentDebounceSeq(
  db: SupabaseClient,
  conversationId: string,
): Promise<number | null> {
  const { data, error } = await db.rpc('current_ai_reply_debounce_seq', {
    p_conversation_id: conversationId,
  })
  if (error || data == null) return null
  return Number(data)
}

/** Atomically claim the reply for `seq`. True only for the holder of
 *  the current sequence, once the deadline has elapsed — exactly one
 *  caller per burst can win. */
async function claimDebounce(
  db: SupabaseClient,
  conversationId: string,
  seq: number,
): Promise<boolean> {
  const { data, error } = await db.rpc('claim_ai_reply_debounce', {
    p_conversation_id: conversationId,
    p_seq: seq,
  })
  return !error && data === true
}

/**
 * Wait out the quiet period for `mySeq`. Polls in short increments so a
 * superseding message (which bumps the sequence past mine) is noticed
 * quickly and this invocation stands down early instead of sleeping the
 * whole window. Returns true if `mySeq` is still current when the window
 * elapses (proceed to claim), false the moment it's been superseded.
 *
 * This is only an optimization — the atomic claimDebounce is what
 * actually guarantees a single reply — so a plain seq read per poll is
 * fine. The window is a fixed wall-clock duration here; the DB deadline
 * set by bumpDebounce is the authoritative gate the claim checks.
 */
async function waitForQuietPeriod(
  db: SupabaseClient,
  conversationId: string,
  mySeq: number,
  waitMs: number,
): Promise<boolean> {
  const deadline = Date.now() + waitMs
  for (;;) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) return true
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(remaining, QUIET_POLL_INTERVAL_MS)),
    )
    const seq = await currentDebounceSeq(db, conversationId)
    if (seq !== null && seq > mySeq) return false
  }
}
