import { NextResponse } from 'next/server'
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'

/**
 * GET /api/notifications
 *
 * Unified notification feed for the header bell. Derived on read from
 * existing tables (no notifications table / write fan-out needed):
 *
 *   - message  — conversations with unread inbound messages
 *   - handoff  — the AI agent handed a chat off and no human owns it yet
 *   - template — a template Meta approved/rejected in the last 7 days
 *   - campaign — a broadcast that finished sending in the last 7 days
 *
 * All queries run under the caller's RLS-scoped client, so the feed is
 * automatically account-scoped. Sorted newest-first, capped at 25.
 */

export interface NotificationItem {
  id: string
  type: 'message' | 'handoff' | 'template' | 'campaign'
  title: string
  body: string
  /** ISO timestamp the item is sorted/highlighted by. */
  at: string
  /** In-app destination when the row is clicked. */
  href: string
}

const WINDOW_DAYS = 7

interface ContactJoin {
  name: string | null
  phone: string | null
}

function contactLabel(contact: ContactJoin | ContactJoin[] | null): string {
  const c = Array.isArray(contact) ? contact[0] : contact
  return c?.name || c?.phone || 'Unknown contact'
}

export async function GET() {
  try {
    const { supabase } = await getCurrentAccount()
    const since = new Date(
      Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString()

    const [unread, handoffs, templates, broadcasts] = await Promise.all([
      supabase
        .from('conversations')
        .select(
          'id, unread_count, last_message_at, contact:contacts(name, phone)',
        )
        .gt('unread_count', 0)
        .order('last_message_at', { ascending: false })
        .limit(15),
      supabase
        .from('conversations')
        .select('id, updated_at, contact:contacts(name, phone)')
        .eq('ai_autoreply_disabled', true)
        .is('assigned_agent_id', null)
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(10),
      supabase
        .from('message_templates')
        .select('id, name, status, updated_at')
        .in('status', ['APPROVED', 'REJECTED'])
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(10),
      supabase
        .from('broadcasts')
        .select('id, name, status, sent_count, total_recipients, created_at')
        .in('status', ['sent', 'failed'])
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    const items: NotificationItem[] = []

    for (const row of unread.data ?? []) {
      // Inbound-only by construction: unread_count is bumped only when an
      // inbound message arrives (never on send). We intentionally do NOT
      // surface last_message_text here — it can be overwritten by an
      // outbound reply, which would leak a sent message into the feed and
      // expose message content. Show a generic, count-based summary instead.
      const unread = row.unread_count ?? 0
      items.push({
        id: `msg-${row.id}`,
        type: 'message',
        title: contactLabel(row.contact as ContactJoin | ContactJoin[] | null),
        body: unread > 1 ? `${unread} new messages` : 'New message',
        at: row.last_message_at ?? new Date().toISOString(),
        href: `/inbox?c=${row.id}`,
      })
    }

    for (const row of handoffs.data ?? []) {
      items.push({
        id: `handoff-${row.id}`,
        type: 'handoff',
        title: `AI handed off — ${contactLabel(row.contact as ContactJoin | ContactJoin[] | null)}`,
        body: 'The AI agent stepped back; this chat needs a human.',
        at: row.updated_at,
        href: `/inbox?c=${row.id}`,
      })
    }

    for (const row of templates.data ?? []) {
      const approved = row.status === 'APPROVED'
      items.push({
        id: `tmpl-${row.id}`,
        type: 'template',
        title: approved ? 'Template approved' : 'Template rejected',
        body: row.name,
        at: row.updated_at,
        href: '/templates',
      })
    }

    for (const row of broadcasts.data ?? []) {
      items.push({
        id: `bc-${row.id}`,
        type: 'campaign',
        title: row.status === 'failed' ? 'Campaign failed' : 'Campaign sent',
        body: `${row.name} — ${row.sent_count}/${row.total_recipients} sent`,
        at: row.created_at,
        href: '/campaigns',
      })
    }

    items.sort((a, b) => (a.at < b.at ? 1 : -1))

    return NextResponse.json({ notifications: items.slice(0, 25) })
  } catch (err) {
    return toErrorResponse(err)
  }
}
