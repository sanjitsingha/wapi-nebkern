// ============================================================
// /api/notifications/mentions
//
//   GET   — my unread @mentions, hydrated for the bell.
//   PATCH — mark them read (all, or one thread's worth).
//
// Split from /api/notifications rather than folded into it. That route
// synthesises a feed from five source tables and has no rows of its
// own, which is why its "dismiss" is a localStorage list. Mentions ARE
// rows, addressed to one person, and read state belongs in the database
// so it survives a different device. Merging them would have meant
// bending one model into the other.
// ============================================================

import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { mentionPlainText } from '@/lib/inbox/mentions';

/** The bell shows a handful; the rest are reachable in the thread. */
const LIMIT = 20;

interface MentionRow {
  id: string;
  contact_id: string;
  created_at: string;
  message_id: string;
}

export async function GET() {
  try {
    const ctx = await getCurrentAccount();

    // RLS already restricts this to the caller's own mentions — the
    // explicit user_id filter is belt-and-braces, and makes the intent
    // readable without knowing the policy.
    const { data: mentions, error } = await ctx.supabase
      .from('contact_thread_mentions')
      .select('id, contact_id, created_at, message_id')
      .eq('user_id', ctx.userId)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(LIMIT);

    if (error) {
      console.error('[mentions] load failed:', error.message);
      return NextResponse.json({ mentions: [] });
    }

    const rows = (mentions ?? []) as MentionRow[];
    if (rows.length === 0) return NextResponse.json({ mentions: [] });

    // Hydrate in two batched queries rather than N per mention. A bell
    // item has to say who, about whom, and what — an id alone is
    // useless to the person reading it.
    const messageIds = [...new Set(rows.map((r) => r.message_id))];
    const contactIds = [...new Set(rows.map((r) => r.contact_id))];

    const [{ data: messages }, { data: contacts }, { data: profiles }] =
      await Promise.all([
        ctx.supabase
          .from('contact_thread_messages')
          .select('id, body, author_id, deleted_at')
          .in('id', messageIds),
        ctx.supabase
          .from('contacts')
          .select('id, name, phone')
          .in('id', contactIds),
        ctx.supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .eq('account_id', ctx.accountId),
      ]);

    const messageById = new Map(
      (messages ?? []).map((m) => [m.id as string, m]),
    );
    const contactById = new Map(
      (contacts ?? []).map((c) => [c.id as string, c]),
    );
    const profileById = new Map(
      (profiles ?? []).map((p) => [p.user_id as string, p]),
    );

    const hydrated = rows.flatMap((r) => {
      const message = messageById.get(r.message_id);
      // A message deleted since the mention was made has nothing left
      // to show, so the notification goes with it.
      if (!message || message.deleted_at) return [];

      const contact = contactById.get(r.contact_id);
      const author = profileById.get(message.author_id as string);

      return [
        {
          id: r.id,
          contactId: r.contact_id,
          contactName:
            (contact?.name as string) ||
            (contact?.phone as string) ||
            'a contact',
          authorName: (author?.full_name as string) || 'Someone',
          authorAvatar: (author?.avatar_url as string) ?? null,
          // Rendered form: the raw body carries `@[Name](uuid)` tokens
          // that would be noise in a notification.
          body: mentionPlainText(message.body as string),
          at: r.created_at,
        },
      ];
    });

    return NextResponse.json({ mentions: hydrated });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    const payload = (await request.json().catch(() => null)) as {
      contactId?: unknown;
      mentionId?: unknown;
    } | null;

    let q = ctx.supabase
      .from('contact_thread_mentions')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', ctx.userId)
      .is('read_at', null);

    // Opening a contact's thread clears that contact's mentions;
    // dismissing one item clears just it; neither argument clears all.
    if (typeof payload?.contactId === 'string') {
      q = q.eq('contact_id', payload.contactId);
    } else if (typeof payload?.mentionId === 'string') {
      q = q.eq('id', payload.mentionId);
    }

    const { error } = await q;
    if (error) {
      console.error('[mentions] mark read failed:', error.message);
      return NextResponse.json(
        { error: 'Could not update.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
