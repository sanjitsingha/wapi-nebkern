// ============================================================
// /api/contacts/[id]/thread
//
//   GET  — the internal team thread for one contact, with authors.
//   POST — add a message, and notify anyone mentioned in it.
//
// Any member can read and post: the thread is the team's shared
// conversation about a customer, and a private one would be a DM
// feature this is not.
//
// The mention rows are written HERE rather than from the browser. The
// client composes the `@[Name](uuid)` token, so the ids in a body are
// user input — resolveMentions checks each one against this account's
// member list before anything is inserted. RLS would stop a foreign
// account_id, but not a valid-looking id belonging to a member of
// another tenant, which is exactly the token someone would forge.
// ============================================================

import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { resolveMentions } from '@/lib/inbox/mentions';
import type { MentionableMember } from '@/types';

/** Cap: a thread message is a comment, not a document. */
const MAX_BODY = 4000;

interface AuthorRow {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: contactId } = await params;
    const ctx = await getCurrentAccount();

    const { data: messages, error } = await ctx.supabase
      .from('contact_thread_messages')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[contact thread] load failed:', error.message);
      return NextResponse.json(
        { error: 'Could not load the thread.' },
        { status: 500 },
      );
    }

    // Author names in one query rather than a join per message — the
    // roster is small and this is the same list the mention picker
    // needs, so the client gets both from one response.
    const { data: profiles } = await ctx.supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .eq('account_id', ctx.accountId);

    const authors: Record<string, AuthorRow> = {};
    for (const p of (profiles ?? []) as AuthorRow[]) {
      authors[p.user_id] = p;
    }

    return NextResponse.json({ messages: messages ?? [], authors });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: contactId } = await params;
    const ctx = await getCurrentAccount();

    const payload = (await request.json().catch(() => null)) as {
      body?: unknown;
    } | null;
    const body = typeof payload?.body === 'string' ? payload.body.trim() : '';

    if (!body) {
      return NextResponse.json(
        { error: 'Write something first.' },
        { status: 400 },
      );
    }
    if (body.length > MAX_BODY) {
      return NextResponse.json(
        { error: `Keep it under ${MAX_BODY} characters.` },
        { status: 400 },
      );
    }

    // Confirm the contact is ours before writing anything against it.
    // RLS on the insert would catch a foreign contact_id via the
    // account_id column, but the error it produces says nothing useful.
    const { data: contact } = await ctx.supabase
      .from('contacts')
      .select('id')
      .eq('id', contactId)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
    }

    const { data: message, error } = await ctx.supabase
      .from('contact_thread_messages')
      .insert({
        account_id: ctx.accountId,
        contact_id: contactId,
        author_id: ctx.userId,
        body,
      })
      .select('*')
      .single();

    if (error || !message) {
      console.error('[contact thread] insert failed:', error?.message);
      return NextResponse.json(
        { error: 'Could not post the message.' },
        { status: 500 },
      );
    }

    // ── Mentions ──
    //
    // Best effort, and deliberately after the message is committed: a
    // failure here costs a notification, while failing the whole
    // request would lose a message the author has already written.
    const { data: members } = await ctx.supabase
      .from('profiles')
      .select('user_id, full_name, email, avatar_url')
      .eq('account_id', ctx.accountId);

    const mentioned = resolveMentions(
      body,
      (members ?? []) as MentionableMember[],
      ctx.userId,
    );

    if (mentioned.length > 0) {
      const { error: mentionError } = await ctx.supabase
        .from('contact_thread_mentions')
        .insert(
          mentioned.map((userId) => ({
            account_id: ctx.accountId,
            message_id: message.id,
            contact_id: contactId,
            user_id: userId,
          })),
        );
      if (mentionError) {
        console.error(
          '[contact thread] mention insert failed:',
          mentionError.message,
        );
      }
    }

    return NextResponse.json({ message, mentioned: mentioned.length });
  } catch (err) {
    return toErrorResponse(err);
  }
}
