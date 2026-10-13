// ============================================================
// WhatsApp chats → notes on the person's Zoho record (server only).
//
// Runs every minute from the webhook dispatch cron, for connections
// with "Log WhatsApp chats in Zoho" on.
//
// ── One note per stretch of chat ──
//
// Not one per message: Zoho notes can only be added (our scope is
// notes.CREATE, no update), and a note per message would bury the
// record. A conversation is written once it has gone quiet for
// QUIET_MS — or FORCE_AFTER_MS after the customer wrote, for a chat
// that never pauses — as one note holding every message since the
// last one written (zoho_chat_logs.logged_until, per conversation).
//
// ── What gets written ──
//
//   ONLY CHATS THE CUSTOMER TOOK PART IN. A broadcast nobody answered
//   is not a conversation, and writing one note per recipient would
//   spend a campaign's worth of Zoho API calls on nothing. Candidates
//   are found by customer_replied_at, and a stretch without a customer
//   message only moves the cursor.
//
//   ONLY PEOPLE IN ZOHO. The note goes on the Lead or Contact the
//   person is linked to (zoho_record_links). Someone not in Zoho yet —
//   their push is still queued, or contact creation is off — is looked
//   at again after RECHECK_MS.
//
//   NEVER SPAM OR BLOCKED CONTACTS, and never more than LOOKBACK_MS of
//   history, so switching logging on does not pour months into Zoho.
//
// Times are written in IST: accounts have no timezone setting, and the
// product is used in India.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { zohoApiFetch } from './api';

type Db = SupabaseClient;

const QUIET_MS = 10 * 60_000;
const FORCE_AFTER_MS = 60 * 60_000;
const LOOKBACK_MS = 3 * 24 * 3600_000;
const RECHECK_MS = 15 * 60_000;
const MAX_MESSAGES = 500;
/** Comfortably inside Zoho's note size, and still readable. */
export const MAX_NOTE_CHARS = 9000;

export interface ChatMessage {
  sender_type: string;
  sender_id?: string | null;
  content_type: string;
  content_text?: string | null;
  template_name?: string | null;
  created_at: string;
}

const LABEL: Record<string, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Voice note',
  document: 'Document',
  location: 'Location',
  call: 'Call',
  form_response: 'Form reply',
};

/** One message as text. Media has no URL here: ours are private, and a
 *  link that 403s in Zoho is worse than a label. */
export function messageText(m: ChatMessage): string {
  const text = (m.content_text ?? '').trim();
  switch (m.content_type) {
    case 'text':
      return text || '(empty message)';
    case 'template':
      return m.template_name
        ? `[Template: ${m.template_name}]${text ? ` ${text}` : ''}`
        : text || '[Template]';
    case 'interactive':
      return text ? `↩ ${text}` : '[Button reply]';
    default: {
      const label = LABEL[m.content_type] ?? m.content_type;
      return text ? `[${label}] ${text}` : `[${label}]`;
    }
  }
}

const TIME = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const DAY = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export interface ChatLine {
  at: string;
  who: string;
  text: string;
}

export interface ChatNote {
  title: string;
  content: string;
  /** Time of the last message in this note — the cursor after it. */
  until: string;
}

/**
 * Lay a stretch of chat out as notes: one line per message, split into
 * notes of at most `maxChars`. A single message longer than that is cut
 * rather than allowed to make a note Zoho refuses.
 */
export function buildChatNotes(
  lines: ChatLine[],
  channel: string,
  maxChars: number = MAX_NOTE_CHARS,
): ChatNote[] {
  const chunks: { text: string[]; until: string; first: string }[] = [];
  let current: { text: string[]; until: string; first: string } | null = null;
  let length = 0;

  for (const line of lines) {
    let rendered = `${TIME.format(new Date(line.at))} · ${line.who}: ${line.text}`;
    if (rendered.length > maxChars) rendered = `${rendered.slice(0, maxChars - 1)}…`;
    if (current && length + rendered.length + 1 > maxChars) {
      chunks.push(current);
      current = null;
    }
    if (!current) {
      current = { text: [], until: line.at, first: line.at };
      length = 0;
    }
    current.text.push(rendered);
    current.until = line.at;
    length += rendered.length + 1;
  }
  if (current) chunks.push(current);

  return chunks.map((chunk, i) => ({
    title: `${channel} chat · ${DAY.format(new Date(chunk.first))}${
      chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : ''
    }`,
    content: chunk.text.join('\n'),
    until: chunk.until,
  }));
}

export interface ChatLogState {
  logged_until: string | null;
  checked_at: string | null;
  notes_created?: number | null;
}

/** Does this conversation have customer messages not yet in Zoho, and
 *  has it not been looked at within RECHECK_MS? */
export function isChatDue(
  conv: { customer_replied_at: string | null },
  state: ChatLogState | undefined,
  now: number = Date.now(),
): boolean {
  if (!conv.customer_replied_at) return false;
  const replied = Date.parse(conv.customer_replied_at);
  if (state?.logged_until && Date.parse(state.logged_until) >= replied) return false;
  if (state?.checked_at && now - Date.parse(state.checked_at) < RECHECK_MS) return false;
  return true;
}

const CHANNEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
};

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

/** Write one conversation's unlogged stretch. Returns notes written. */
async function logConversation(
  db: Db,
  conn: Connection,
  conv: Conversation,
  state: ChatLogState | undefined,
  now: number,
): Promise<number> {
  const nowIso = new Date(now).toISOString();
  let notesCreated = state?.notes_created ?? 0;
  const mark = (patch: Record<string, unknown>) =>
    db.from('zoho_chat_logs').upsert(
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
    .from('zoho_record_links')
    .select('zoho_module, zoho_id')
    .eq('account_id', conn.account_id)
    .eq('entity', 'contact')
    .eq('local_id', contact.id)
    .maybeSingle();
  if (!link || (link.zoho_module !== 'Leads' && link.zoho_module !== 'Contacts')) {
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
    const { data: profiles } = await db
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', agentIds);
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

  let written = 0;
  for (const note of buildChatNotes(lines, CHANNEL[conv.channel ?? 'whatsapp'] ?? 'WhatsApp')) {
    const res = await zohoApiFetch<{ data?: { status?: string; message?: string }[] }>(
      db,
      conn.account_id,
      `/crm/v5/${link.zoho_module}/${encodeURIComponent(link.zoho_id as string)}/Notes`,
      {
        method: 'POST',
        body: JSON.stringify({ data: [{ Note_Title: note.title, Note_Content: note.content }] }),
      },
    );
    if (res.data?.data?.[0]?.status !== 'success') {
      console.error(
        '[zoho/chat-log] note refused:',
        res.error ?? res.data?.data?.[0]?.message ?? 'unknown',
      );
      await mark({ checked_at: nowIso });
      return written;
    }
    // The cursor moves note by note, so a failure part-way through a
    // long stretch never writes the earlier notes twice.
    written += 1;
    notesCreated += 1;
    await mark({ logged_until: note.until, checked_at: nowIso, notes_created: notesCreated });
  }
  return written;
}

export interface ChatLogSummary {
  conversations: number;
  notes: number;
}

export async function logZohoChats(
  db: Db,
  { budgetMs = 12_000, now = Date.now() }: { budgetMs?: number; now?: number } = {},
): Promise<ChatLogSummary> {
  const started = Date.now();
  const summary: ChatLogSummary = { conversations: 0, notes: 0 };

  const { data: connections } = await db
    .from('zoho_connections')
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
      // Their ids go into one IN (...) below, which rides in the URL.
      .limit(100);
    if (!convs?.length) continue;

    const { data: states } = await db
      .from('zoho_chat_logs')
      .select('conversation_id, logged_until, checked_at, notes_created')
      .in(
        'conversation_id',
        convs.map((c) => c.id),
      );
    const byId = new Map(
      (states ?? []).map((s) => [s.conversation_id as string, s as ChatLogState]),
    );

    for (const conv of convs as Conversation[]) {
      if (Date.now() - started > budgetMs) break;
      const state = byId.get(conv.id);
      if (!isChatDue(conv, state, now)) continue;
      summary.conversations += 1;
      try {
        summary.notes += await logConversation(db, conn, conv, state, now);
      } catch (err) {
        console.error('[zoho/chat-log] conversation failed:', err);
      }
    }
  }
  return summary;
}
