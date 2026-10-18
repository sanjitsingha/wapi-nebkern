// ============================================================
// Chats → the person's HubSpot timeline (server only).
//
// Runs every minute from the webhook dispatch cron, for connections
// with "Log chats in HubSpot" on. The same rules as Zoho's chat log
// (lib/zoho/chat-log.ts, whose transcript helpers this reuses): one
// entry per stretch of chat once it has gone quiet, only chats the
// customer took part in, only people already linked in HubSpot, never
// spam or blocked contacts, and never more than three days back.
//
// A WhatsApp chat is logged as a WhatsApp message — HubSpot's own
// communication type for it, shown on the timeline as one. Instagram
// and Messenger have no such type, so those stretches are notes.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildChatNotes,
  isChatDue,
  messageText,
  type ChatLine,
  type ChatLogState,
  type ChatMessage,
} from '@/lib/zoho/chat-log';
import { hubspotApiFetch } from './api';
import { ASSOC } from './push';

type Db = SupabaseClient;

const QUIET_MS = 10 * 60_000;
const FORCE_AFTER_MS = 60 * 60_000;
const LOOKBACK_MS = 3 * 24 * 3600_000;
const MAX_MESSAGES = 500;

const CHANNEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** A stretch of chat as HubSpot's rich-text body: the title in bold,
 *  then one paragraph per message. */
export function timelineBody(title: string, content: string): string {
  const lines = content.split('\n').map((l) => `<p>${escapeHtml(l)}</p>`);
  return `<p><strong>${escapeHtml(title)}</strong></p>${lines.join('')}`;
}

/** A "name" that is really the phone or a channel id. */
function realName(c: {
  name: string | null;
  instagram_id: string | null;
  messenger_id: string | null;
}): string | null {
  const n = (c.name ?? '').trim();
  if (!n || /^[+\d\s()-]+$/.test(n) || n === c.instagram_id || n === c.messenger_id) return null;
  return n;
}

interface Conversation {
  id: string;
  contact_id: string;
  channel: string | null;
  customer_replied_at: string | null;
}

interface Connection {
  account_id: string;
  connected_at: string | null;
}

interface LogState extends ChatLogState {
  entries_created?: number | null;
}

async function logConversation(
  db: Db,
  conn: Connection,
  conv: Conversation,
  state: LogState | undefined,
  now: number,
): Promise<number> {
  const nowIso = new Date(now).toISOString();
  let entries = state?.entries_created ?? 0;
  const mark = (patch: Record<string, unknown>) =>
    db.from('hubspot_chat_logs').upsert(
      { conversation_id: conv.id, account_id: conn.account_id, ...patch, updated_at: nowIso },
      { onConflict: 'conversation_id' },
    );

  const { data: contact } = await db
    .from('contacts')
    .select('id, name, instagram_id, messenger_id, is_spam, is_blocked')
    .eq('id', conv.contact_id)
    .maybeSingle();
  if (!contact || contact.is_spam || contact.is_blocked) {
    await mark({ logged_until: conv.customer_replied_at, checked_at: nowIso });
    return 0;
  }

  const { data: link } = await db
    .from('hubspot_record_links')
    .select('hubspot_id')
    .eq('account_id', conn.account_id)
    .eq('entity', 'contact')
    .eq('local_id', contact.id)
    .maybeSingle();
  if (!link) {
    // Not in HubSpot yet (their push is still queued): look again later.
    await mark({ checked_at: nowIso });
    return 0;
  }

  const floor = Math.max(now - LOOKBACK_MS, conn.connected_at ? Date.parse(conn.connected_at) : 0);
  const start = Math.max(state?.logged_until ? Date.parse(state.logged_until) : 0, floor);
  const { data: rows } = await db
    .from('messages')
    .select('sender_type, sender_id, content_type, content_text, template_name, created_at')
    .eq('conversation_id', conv.id)
    .gt('created_at', new Date(start).toISOString())
    .order('created_at', { ascending: true })
    .limit(MAX_MESSAGES);
  const messages = (rows ?? []) as ChatMessage[];

  // Nothing from the customer since the cursor: settle it, write nothing.
  if (!messages.some((m) => m.sender_type === 'customer')) {
    const last = messages[messages.length - 1]?.created_at;
    const replied = conv.customer_replied_at;
    const settle =
      last && replied ? (Date.parse(last) > Date.parse(replied) ? last : replied) : (last ?? replied);
    await mark({ logged_until: settle, checked_at: nowIso });
    return 0;
  }

  const agentIds = [
    ...new Set(
      messages.filter((m) => m.sender_type === 'agent' && m.sender_id).map((m) => m.sender_id as string),
    ),
  ];
  const agents = new Map<string, string>();
  if (agentIds.length) {
    const { data: profiles } = await db.from('profiles').select('user_id, full_name').in('user_id', agentIds);
    for (const p of profiles ?? []) {
      if (p.full_name) agents.set(p.user_id as string, p.full_name as string);
    }
  }

  const customer = realName(contact) ?? 'Customer';
  const lines: ChatLine[] = messages.map((m) => ({
    at: m.created_at,
    who:
      m.sender_type === 'customer'
        ? customer
        : m.sender_type === 'bot'
          ? 'Bot'
          : (m.sender_id && agents.get(m.sender_id)) || 'Team',
    text: messageText(m),
  }));

  const channel = conv.channel ?? 'whatsapp';
  const hubspotId = link.hubspot_id as string;
  let written = 0;
  for (const note of buildChatNotes(lines, CHANNEL[channel] ?? 'WhatsApp')) {
    const body = timelineBody(note.title, note.content);
    const res =
      channel === 'whatsapp'
        ? await hubspotApiFetch<{ id?: string }>(db, conn.account_id, '/crm/v3/objects/communications', {
            method: 'POST',
            body: JSON.stringify({
              properties: {
                hs_communication_channel_type: 'WHATS_APP',
                hs_communication_logged_from: 'CRM',
                hs_communication_body: body,
                hs_timestamp: note.until,
              },
              associations: [
                {
                  to: { id: hubspotId },
                  types: [
                    { associationCategory: 'HUBSPOT_DEFINED', associationTypeId: ASSOC.communicationToContact },
                  ],
                },
              ],
            }),
          })
        : await hubspotApiFetch<{ id?: string }>(db, conn.account_id, '/crm/v3/objects/notes', {
            method: 'POST',
            body: JSON.stringify({
              properties: { hs_note_body: body, hs_timestamp: note.until },
              associations: [
                {
                  to: { id: hubspotId },
                  types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: ASSOC.noteToContact }],
                },
              ],
            }),
          });
    if (!res.data?.id) {
      console.error('[hubspot/chat-log] entry refused:', res.error ?? 'unknown');
      await mark({ checked_at: nowIso });
      return written;
    }
    // The cursor moves entry by entry, so a failure part-way through a
    // long stretch never writes the earlier ones twice.
    written += 1;
    entries += 1;
    await mark({ logged_until: note.until, checked_at: nowIso, entries_created: entries });
  }
  return written;
}

export interface ChatLogSummary {
  conversations: number;
  entries: number;
}

export async function logHubSpotChats(
  db: Db,
  { budgetMs = 8_000, now = Date.now() }: { budgetMs?: number; now?: number } = {},
): Promise<ChatLogSummary> {
  const started = Date.now();
  const summary: ChatLogSummary = { conversations: 0, entries: 0 };

  const { data: connections } = await db
    .from('hubspot_connections')
    .select('account_id, connected_at')
    .eq('is_active', true)
    .eq('log_chats', true)
    .not('refresh_token', 'is', null);

  for (const conn of (connections ?? []) as Connection[]) {
    if (Date.now() - started > budgetMs) break;

    const { data: convs } = await db
      .from('conversations')
      .select('id, contact_id, channel, customer_replied_at')
      .eq('account_id', conn.account_id)
      .gt('customer_replied_at', new Date(now - LOOKBACK_MS).toISOString())
      .or(
        `last_message_at.lt.${new Date(now - QUIET_MS).toISOString()},customer_replied_at.lt.${new Date(now - FORCE_AFTER_MS).toISOString()}`,
      )
      .order('customer_replied_at', { ascending: false })
      .limit(100);
    if (!convs?.length) continue;

    const { data: states } = await db
      .from('hubspot_chat_logs')
      .select('conversation_id, logged_until, checked_at, entries_created')
      .in(
        'conversation_id',
        convs.map((c) => c.id),
      );
    const byId = new Map((states ?? []).map((s) => [s.conversation_id as string, s as LogState]));

    for (const conv of convs as Conversation[]) {
      if (Date.now() - started > budgetMs) break;
      const state = byId.get(conv.id);
      if (!isChatDue(conv, state, now)) continue;
      summary.conversations += 1;
      try {
        summary.entries += await logConversation(db, conn, conv, state, now);
      } catch (err) {
        console.error('[hubspot/chat-log] conversation failed:', err);
      }
    }
  }
  return summary;
}
