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
import { PersonAvatar } from '@/components/ui/person-avatar';
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

// A tagged teammate reads as their photo and name — in the composer
// while the message is being written, and in the bubble once it is
// posted. `@[Name](uuid)` is only ever the stored form; nobody should
// see it. Both places share this so the chip does not change on send.
const CHIP_CLASS =
  'bg-primary/10 text-primary mx-px inline-flex select-none items-center gap-1 rounded-full py-px pr-1.5 pl-0.5 align-middle font-medium leading-4';

/** Keys that move the caret without an input event. */
const CARET_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
]);

export function TeamThread({ contactId }: { contactId: string }) {
  const { user, accountId } = useAuth();
  const supabase = createClient();

  const [messages, setMessages] = useState<ContactThreadMessage[] | null>(null);
  const [authors, setAuthors] = useState<Record<string, Author>>({});
  const [members, setMembers] = useState<MentionableMember[]>([]);
  const [isEmpty, setIsEmpty] = useState(true);
  const [sending, setSending] = useState(false);

  // Mention picker state.
  const [mentionQuery, setMentionQuery] = useState<{
    query: string;
    start: number;
  } | null>(null);
  const [highlight, setHighlight] = useState(0);

  // The composer is contentEditable, not a textarea, because a textarea
  // can only hold text — a tag would have to be the raw token. React
  // renders no children into it; the DOM inside is the draft, and
  // `serializeDraft` turns it back into the stored body on send.
  const editorRef = useRef<HTMLDivElement>(null);
  // Which text node the `@…` being typed sits in, and its span, so
  // accepting a suggestion replaces exactly that run.
  const mentionAnchorRef = useRef<{
    node: Text;
    start: number;
    end: number;
  } | null>(null);
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
    const incoming = data.messages ?? [];
    const seenMsgIds = new Set<string>();
    const dedupedMessages = incoming.filter((m) => {
      if (!m?.id || seenMsgIds.has(m.id)) return false;
      seenMsgIds.add(m.id);
      return true;
    });
    setMessages(dedupedMessages);
    setAuthors(data.authors ?? {});

    const authorList = Object.values(data.authors ?? {});
    const seenUserIds = new Set<string>();
    const dedupedMembers: MentionableMember[] = [];
    for (const a of authorList) {
      if (a.user_id && !seenUserIds.has(a.user_id)) {
        seenUserIds.add(a.user_id);
        dedupedMembers.push({
          user_id: a.user_id,
          full_name: a.full_name ?? 'Member',
          email: '',
          avatar_url: a.avatar_url,
        });
      }
    }
    setMembers(dedupedMembers);
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
          if (!row?.id) return;
          setMessages((prev) => {
            if (!prev) return [row];
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
    const seen = new Set<string>();
    return members
      .filter((m) => m.user_id !== user?.id)
      .filter((m) => !q || m.full_name.toLowerCase().includes(q))
      .filter((m) => {
        if (seen.has(m.user_id)) return false;
        seen.add(m.user_id);
        return true;
      })
      .slice(0, 6);
  }, [mentionQuery, members, user?.id]);

  const closeMention = () => {
    mentionAnchorRef.current = null;
    setMentionQuery(null);
  };

  /** Re-read the caret and open, narrow or close the picker to match. */
  const syncMention = () => {
    const editor = editorRef.current;
    const sel = window.getSelection();
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    const node = range?.startContainer;
    if (
      !editor ||
      !range ||
      !range.collapsed ||
      !node ||
      node.nodeType !== Node.TEXT_NODE ||
      !editor.contains(node)
    ) {
      closeMention();
      return;
    }

    // Only the caret's own text node is searched: a chip ends the text
    // before it, the same way a completed token did in the old textarea.
    const found = activeMentionQuery(node.textContent ?? '', range.startOffset);
    if (!found) {
      closeMention();
      return;
    }
    mentionAnchorRef.current = {
      node: node as Text,
      start: found.start,
      end: range.startOffset,
    };
    setMentionQuery(found);
  };

  const onDraftInput = () => {
    const editor = editorRef.current;
    if (!editor) return;
    setIsEmpty(serializeDraft(editor).trim() === '');
    syncMention();
    setHighlight(0);
  };

  const acceptMention = (member: MentionableMember) => {
    const editor = editorRef.current;
    const anchor = mentionAnchorRef.current;
    closeMention();
    if (!editor || !anchor || !editor.contains(anchor.node)) return;

    // Cut the typed `@query` out of its text node and put the chip, then
    // a space, where it was.
    const { node, start, end } = anchor;
    const rest = node.splitText(end);
    node.deleteData(start, end - start);
    const space = document.createTextNode(' ');
    rest.before(createMentionChip(member), space);

    // Caret after the space, so typing carries straight on.
    editor.focus();
    const caret = document.createRange();
    caret.setStart(space, 1);
    caret.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(caret);
    setIsEmpty(false);
  };

  const send = async () => {
    const editor = editorRef.current;
    const body = editor ? serializeDraft(editor).trim() : '';
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
      editorRef.current?.replaceChildren();
      setIsEmpty(true);
      closeMention();
      if (data.message && data.message.id) {
        setMessages((prev) => {
          if (!prev) return [data.message];
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
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
                key={m.id || `msg-${i}`}
                message={m}
                author={authors[m.author_id]}
                authors={authors}
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
          <div className="relative min-w-0 flex-1">
            {isEmpty && (
              <span
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute top-2 left-3 text-xs leading-4"
              >
                Message your team… use @ to tag someone
              </span>
            )}
            <div
              ref={editorRef}
              contentEditable
              role="textbox"
              aria-multiline="true"
              aria-label="Message your team"
              onInput={onDraftInput}
              onKeyUp={(e) => {
                if (CARET_KEYS.has(e.key)) syncMention();
              }}
              onClick={syncMention}
              onBlur={closeMention}
              // Plain text only — pasted or dropped markup would carry
              // styles and elements the serializer does not expect.
              onPaste={(e) => {
                e.preventDefault();
                document.execCommand(
                  'insertText',
                  false,
                  e.clipboardData.getData('text/plain'),
                );
              }}
              onDrop={(e) => e.preventDefault()}
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
                    closeMention();
                    return;
                  }
                }
                // Enter while an IME is composing picks the candidate.
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send();
                }
              }}
              className="border-border bg-muted text-foreground focus:border-primary/50 max-h-32 min-h-[50px] overflow-y-auto rounded-lg border px-3 py-2 text-xs leading-4 break-words whitespace-pre-wrap outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => void send()}
            disabled={isEmpty || sending}
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
  authors,
  isMine,
  showDay,
}: {
  message: ContactThreadMessage;
  author?: Author;
  authors: Record<string, Author>;
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
        {/* Real profile picture when the member has one; otherwise a
            colour-keyed initial. Inline style, not classes: avatarColor
            returns hex pairs so a member keeps the same colour everywhere. */}
        {author?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={author.avatar_url}
            alt={name}
            title={name}
            className="size-6 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
            style={{ backgroundColor: colors.bg, color: colors.fg }}
            title={name}
          >
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}

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
                    <MentionChip
                      key={i}
                      label={seg.label}
                      userId={seg.userId}
                      avatarUrl={authors[seg.userId]?.avatar_url}
                    />
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

/**
 * A posted mention. The name is the label written into the token, not
 * the member's current name — see lib/inbox/mentions.ts for why. The
 * photo is looked up by id, which cannot re-point at someone else.
 */
function MentionChip({
  label,
  userId,
  avatarUrl,
}: {
  label: string;
  userId: string;
  avatarUrl?: string | null;
}) {
  return (
    <span className={CHIP_CLASS}>
      <PersonAvatar
        name={label}
        avatarUrl={avatarUrl}
        seed={userId}
        className="size-4 text-[8px]"
      />
      <span>{label}</span>
    </span>
  );
}

/**
 * The composer's version of MentionChip, built as DOM because it lives
 * inside contentEditable where React does not render. Keep the two in
 * step. `data-user-id` / `data-label` are what `serializeDraft` reads;
 * contenteditable=false makes the chip one unit to the caret and to
 * Backspace, so it cannot be half-deleted into a broken token.
 */
function createMentionChip(member: MentionableMember): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.contentEditable = 'false';
  chip.dataset.userId = member.user_id;
  chip.dataset.label = member.full_name;
  chip.className = CHIP_CLASS;

  if (member.avatar_url) {
    const img = document.createElement('img');
    img.src = member.avatar_url;
    img.alt = '';
    img.className = 'size-4 shrink-0 rounded-full object-cover';
    chip.append(img);
  } else {
    const colors = avatarColor(member.user_id);
    const initial = document.createElement('span');
    initial.className =
      'flex size-4 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold';
    initial.style.backgroundColor = colors.bg;
    initial.style.color = colors.fg;
    initial.textContent = (member.full_name || '?').charAt(0).toUpperCase();
    chip.append(initial);
  }

  const name = document.createElement('span');
  name.textContent = member.full_name;
  chip.append(name);
  return chip;
}

/**
 * Read the composer back into the stored body: text as typed, each chip
 * as its `@[Name](uuid)` token, line breaks as `\n`. Browsers write a
 * line break as `<br>` or wrap lines in `<div>`s depending on engine,
 * so both are handled.
 */
function serializeDraft(root: HTMLElement): string {
  let out = '';
  const walk = (parent: Node) => {
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        // contentEditable pads spaces with NBSP so they are not collapsed.
        out += (child.textContent ?? '').replace(/ /g, ' ');
        continue;
      }
      if (!(child instanceof HTMLElement)) continue;

      const userId = child.dataset.userId;
      if (userId) {
        out += mentionToken({
          user_id: userId,
          full_name: child.dataset.label ?? '',
          email: '',
        });
        continue;
      }
      if (child.tagName === 'BR') {
        out += '\n';
        continue;
      }
      if ((child.tagName === 'DIV' || child.tagName === 'P') && out && !out.endsWith('\n')) {
        out += '\n';
      }
      walk(child);
    }
  };
  walk(root);
  return out;
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
            <li key={m.user_id || `member-${i}`}>
              <button
                type="button"
                // `onMouseDown`, not `onClick`: a click would blur the
                // composer first, closing the picker before the handler
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
                {m.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.avatar_url}
                    alt={m.full_name}
                    className="size-5 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold"
                    style={{ backgroundColor: colors.bg, color: colors.fg }}
                  >
                    {m.full_name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="truncate">{m.full_name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
