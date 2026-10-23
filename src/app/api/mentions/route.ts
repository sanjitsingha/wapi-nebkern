// ============================================================
// /api/mentions
//
//   PATCH — mark my unread @mentions read: one contact's (opening its
//           Team thread), one mention, or all of them.
//
// Mentions are rows addressed to one person, so their read state lives
// in the database and follows the user across devices. Reading the
// unread ones needs no route: the inbox queries contact_thread_mentions
// directly (hooks/use-unread-mentions.ts), RLS scoping it to the caller.
// ============================================================

import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';

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
    // a mention id clears just it; neither argument clears all.
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
