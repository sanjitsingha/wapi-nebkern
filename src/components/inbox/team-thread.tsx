'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { AtSign, Loader2, SendHorizonal, Users } from 'lucide-react';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { avatarColor } from '@/lib/avatar-color';
import { cn } from '@/lib/utils';
import {
  activeMentionQuery,
  mentionToken,
  segmentBody,
} from '@/lib/inbox/mentions';
import type {
  ContactThreadMessage,
  MentionableMember,
} from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';

// ============================================================
// Team Inbox — the internal thread on one contact.
//
// Everything here is invisible to the customer. It reads like the chat
// beside it on purpose: same shape, same rhythm, so nobody has to learn
// a second thing. What keeps the two apart is colour and side — your
// own words on the right in the accent, colleagues on the left in
// muted, and a heading that says who this is about.
//
// Scoped to one contact. There is no cross-contact team chat here and
// deliberately so: a message about a customer belongs on that customer,
// where the next person to open them finds it.
// ============================================================

interface Author {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export function TeamThread({ contactId }: { contactId: string }) {
  const { user, accountId } = useAuth();
  const supabase = createClient();

  const [messages, setMessages] = useState<ContactThreadMessage[] | null>(null);
  const [authors, setAuthors] = useState<Record<string, Author>>({});
  const [members, setMembers] = useState<MentionableMember[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // Mention picker state. `start` is where the `@` sits, so accepting a
  // suggestion knows what to replace.
  const [mentionQuery, setMentionQuery] = useState<{
    query: string;
    start: number;
  } | null>(null);
  const [highlight, setHighlight] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/contacts/${contactId}/thread`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      setMessages([]);
      return;
    }
    const data = (await res.json()) as {
      messages: ContactThreadMessage[];
      authors: Record<string, Author>;
    };
    setMessages(data.messages ?? []);
    setAuthors(data.authors ?? {});
    setMembers(
      Object.values(data.authors ?? {}).map((a) => ({
        user_id: a.user_id,
        full_name: a.full_name ?? 'Member',
        email: '',
        avatar_url: a.avatar_url,
      })),
    );
  }, [contactId]);

  useEffect(() => {
    setMessages(null);
    void load();
  }, [load]);

  /** Opening the thread is reading it — clear this contact's mentions
   *  so the bell badge does not keep claiming attention already paid. */
  useEffect(() => {
    void fetch('/api/notifications/mentions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId }),
    }).catch(() => {});
  }, [contactId]);

  // Live updates, so two people on the same contact see each other
  // typing into the record rather than discovering it on refresh.
  useEffect(() => {
    if (!accountId) return;
    const channel = supabase
      .channel(`contact-thread:${contactId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'contact_thread_messages',
          filter: `contact_id=eq.${contactId}`,
        },
        (payload) => {
          const row = payload.new as ContactThreadMessage;
          setMessages((prev) => {
            if (!prev) return prev;
            // The sender already appended it optimistically.
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, contactId, accountId]);

  // Pin to the newest message the way a chat does.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const suggestions = useMemo(() => {
    if (!mentionQuery) return [];
    const q = mentionQuery.query.toLowerCase();
    return members
      .filter((m) => m.user_id !== user?.id)
      .filter((m) => !q || m.full_name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, members, user?.id]);

  const onDraftChange = (value: string, caret: number) => {
    setDraft(value);
    setMentionQuery(activeMentionQuery(value, caret));
    setHighlight(0);
  };

  const acceptMention = (member: MentionableMember) => {
    if (!mentionQuery) return;
    const before = draft.slice(0, mentionQuery.start);
    const after = draft.slice(mentionQuery.start + 1 + mentionQuery.query.length);
    const next = `${before}${mentionToken(member)} ${after}`;
    setDraft(next);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/thread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Could not post the message.');
        return;
      }
      setDraft('');
      setMentionQuery(null);
      setMessages((prev) => (prev ? [...prev, data.message] : [data.message]));
      if (data.mentioned > 0) {
        toast.success(
          data.mentioned === 1 ? '1 person notified' : `${data.mentioned} people notified`,
        );
      }
    } finally {
      setSending(false);
    }
  };

  if (messages === null) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="text-muted-foreground size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 px-3 py-3">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            messages.map((m, i) => (
              <ThreadBubble
                key={m.id}
                message={m}
                author={authors[m.author_id]}
                isMine={m.author_id === user?.id}
                // Only date-stamp when the day changes — a timestamp on
                // every line is noise in a thread this narrow.
                showDay={
                  i === 0 ||
                  new Date(m.created_at).toDateString() !==
                    new Date(messages[i - 1].created_at).toDateString()
                }
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-border relative border-t p-2.5">
        {suggestions.length > 0 && (
          <MentionPicker
            members={suggestions}
            highlight={highlight}
            onPick={acceptMention}
          />
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) =>
              onDraftChange(e.target.value, e.target.selectionStart ?? 0)
            }
            onKeyDown={(e) => {
              // The picker owns the arrows and Enter while it is open,
              // or choosing a name would send the message instead.
              if (suggestions.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlight((h) => (h + 1) % suggestions.length);
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlight(
                    (h) => (h - 1 + suggestions.length) % suggestions.length,
                  );
                  return;
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  acceptMention(suggestions[highlight]);
                  return;
                }
                if (e.key === 'Escape') {
                  setMentionQuery(null);
                  return;
                }
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder="Message your team… use @ to tag someone"
            className="border-border bg-muted text-foreground placeholder-muted-foreground focus:border-primary/50 min-h-[38px] flex-1 resize-none rounded-lg border px-3 py-2 text-xs outline-none"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!draft.trim() || sending}
            aria-label="Post to team inbox"
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SendHorizonal className="size-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 py-10 text-center">
      <span className="bg-muted flex size-10 items-center justify-center rounded-full">
        <Users className="text-muted-foreground size-5" />
      </span>
      <p className="text-foreground text-xs font-medium">
        No team messages yet
      </p>
      <p className="text-muted-foreground max-w-[15rem] text-[11px] leading-relaxed">
        Notes about this customer, visible to your team and never to them.
        Type @ to tag a colleague.
      </p>
    </div>
  );
}

function ThreadBubble({
  message,
  author,
  isMine,
  showDay,
}: {
  message: ContactThreadMessage;
  author?: Author;
  isMine: boolean;
  showDay: boolean;
}) {
  const at = new Date(message.created_at);
  const name = author?.full_name ?? 'Member';
  const colors = avatarColor(author?.user_id ?? message.author_id);

  return (
    <>
      {showDay && (
        <div className="flex justify-center py-1">
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-[10px] font-medium">
            {isToday(at)
              ? 'Today'
              : isYesterday(at)
                ? 'Yesterday'
                : format(at, 'MMM d, yyyy')}
          </span>
        </div>
      )}

      <div className={cn('flex gap-2', isMine && 'flex-row-reverse')}>
        {/* Inline style, not classes: avatarColor returns hex pairs so
            a contact keeps the same colour everywhere it appears. */}
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
          style={{ backgroundColor: colors.bg, color: colors.fg }}
          title={name}
        >
          {name.slice(0, 1).toUpperCase()}
        </span>

        <div className={cn('min-w-0 max-w-[80%]', isMine && 'text-right')}>
          <div
            className={cn(
              'inline-block rounded-lg px-2.5 py-1.5 text-left text-xs',
              isMine
                ? 'bg-primary-soft text-foreground'
                : 'bg-muted text-foreground',
            )}
          >
            {!isMine && (
              <p className="text-muted-foreground mb-0.5 text-[10px] font-semibold">
                {name}
              </p>
            )}
            {message.deleted_at ? (
              <p className="text-muted-foreground text-xs italic">
                Message deleted
              </p>
            ) : (
              <p className="whitespace-pre-wrap break-words">
                {/* Segmented, never innerHTML — the body is written by a
                    user and is not markup anywhere in this app. */}
                {segmentBody(message.body).map((seg, i) =>
                  seg.kind === 'mention' ? (
                    <span
                      key={i}
                      className="text-primary bg-primary/10 rounded px-1 font-medium"
                    >
                      @{seg.label}
                    </span>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  ),
                )}
              </p>
            )}
          </div>
          <p className="text-muted-foreground mt-0.5 text-[10px]">
            {format(at, 'HH:mm')}
          </p>
        </div>
      </div>
    </>
  );
}

function MentionPicker({
  members,
  highlight,
  onPick,
}: {
  members: MentionableMember[];
  highlight: number;
  onPick: (m: MentionableMember) => void;
}) {
  return (
    <div className="border-border bg-popover absolute bottom-full left-2.5 z-20 mb-1 w-56 overflow-hidden rounded-lg border shadow-lg">
      <p className="text-muted-foreground border-border flex items-center gap-1.5 border-b px-2.5 py-1.5 text-[10px] font-medium">
        <AtSign className="size-3" />
        Tag a teammate
      </p>
      <ul className="max-h-48 overflow-y-auto py-1">
        {members.map((m, i) => {
          const colors = avatarColor(m.user_id);
          return (
            <li key={m.user_id}>
              <button
                type="button"
                // `onMouseDown`, not `onClick`: a click would blur the
                // textarea first, closing the picker before the handler
                // runs and losing the caret position it needs.
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(m);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors',
                  i === highlight ? 'bg-muted' : 'hover:bg-muted/60',
                )}
              >
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold"
                  style={{ backgroundColor: colors.bg, color: colors.fg }}
                >
                  {m.full_name.slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate">{m.full_name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
