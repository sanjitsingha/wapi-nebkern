'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, Plus, StickyNote, Trash2 } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useCan } from '@/hooks/use-can';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PersonAvatar } from '@/components/ui/person-avatar';
import type { ContactNote } from '@/types';

// ============================================================
// Notes on a contact — one set, two places: the contact page's Notes
// tab and the inbox panel's Overview. Both read and write
// `contact_notes`, so a note added in one is in the other.
//
// Each note shows who wrote it (photo and name) and when. Notes are
// separate from the Team Inbox thread: that one is a conversation with
// @mentions; these are the facts worth keeping about a person.
//
// Any agent can add a note (the table's RLS: agent+). Deleting is for
// the note's author, or an admin.
// ============================================================

const MAX_NOTE = 4000;

interface Author {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

function authorName(author: Author | undefined): string {
  if (!author) return 'Former teammate';
  return author.full_name?.trim() || author.email?.split('@')[0] || 'Teammate';
}

/** A contact's notes, newest first, with their authors. */
function useContactNotes(contactId: string) {
  const supabase = useMemo(() => createClient(), []);
  const { user, accountId } = useAuth();
  // Keyed by contact so switching chats never shows the last person's
  // notes while the next one's load.
  const [loaded, setLoaded] = useState<{ contactId: string; notes: ContactNote[] } | null>(null);
  const [authors, setAuthors] = useState<Record<string, Author>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('contact_notes')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Could not load notes');
      setLoaded({ contactId, notes: [] });
      return;
    }
    const notes = (data ?? []) as ContactNote[];
    setLoaded({ contactId, notes });

    // The authors, in one query. A note by someone who has since left
    // the account keeps its text; their name may no longer be visible.
    const ids = [...new Set(notes.map((n) => n.user_id))];
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, avatar_url')
        .in('user_id', ids);
      setAuthors((prev) => {
        const next = { ...prev };
        for (const p of (profiles ?? []) as Author[]) next[p.user_id] = p;
        return next;
      });
    }
  }, [supabase, contactId]);

  useEffect(() => {
    // The setters run after the Supabase await, not synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const add = useCallback(
    async (text: string): Promise<boolean> => {
      const body = text.trim();
      if (!body) return false;
      if (!user || !accountId) {
        toast.error('Your profile is not linked to an account.');
        return false;
      }
      setSaving(true);
      const { error } = await supabase.from('contact_notes').insert({
        contact_id: contactId,
        account_id: accountId,
        user_id: user.id,
        note_text: body,
      });
      setSaving(false);
      if (error) {
        toast.error('Could not add the note');
        return false;
      }
      await load();
      return true;
    },
    [supabase, contactId, user, accountId, load],
  );

  const remove = useCallback(
    async (noteId: string) => {
      const { error } = await supabase.from('contact_notes').delete().eq('id', noteId);
      if (error) {
        toast.error('Could not delete the note');
        return;
      }
      setLoaded((prev) =>
        prev ? { ...prev, notes: prev.notes.filter((n) => n.id !== noteId) } : prev,
      );
    },
    [supabase],
  );

  return {
    notes: loaded?.contactId === contactId ? loaded.notes : null,
    authors,
    saving,
    add,
    remove,
    userId: user?.id ?? null,
  };
}

function NoteItem({
  note,
  author,
  canDelete,
  onDelete,
  compact,
}: {
  note: ContactNote;
  author: Author | undefined;
  canDelete: boolean;
  onDelete: () => void;
  compact?: boolean;
}) {
  const name = authorName(author);
  return (
    <li
      className={cn(
        'group border-border bg-card rounded-lg border',
        compact ? 'px-2.5 py-2' : 'p-4',
      )}
    >
      <div className="flex items-center gap-2">
        <PersonAvatar
          name={name}
          avatarUrl={author?.avatar_url}
          seed={note.user_id}
          className={compact ? 'size-5 text-[9px]' : 'size-6 text-[10px]'}
        />
        <div className="min-w-0 flex-1">
          <p className={cn('text-foreground truncate font-medium', compact ? 'text-xs' : 'text-sm')}>
            {name}
          </p>
        </div>
        <span className={cn('text-muted-foreground shrink-0', compact ? 'text-[10px]' : 'text-xs')}>
          {format(new Date(note.created_at), compact ? 'd MMM, HH:mm' : 'd MMM yyyy, HH:mm')}
        </span>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete note"
            title="Delete note"
            className="text-muted-foreground hover:text-destructive shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <p
        className={cn(
          'text-foreground mt-1.5 break-words whitespace-pre-wrap',
          compact ? 'text-xs leading-relaxed' : 'text-sm',
        )}
      >
        {note.note_text}
      </p>
    </li>
  );
}

/**
 * The notes on one contact: a way to add one, then every note, newest
 * first.
 *
 * `compact` is the inbox panel's cut. There the section header carries
 * "+ Add", as Tags does (the caller owns that button and passes
 * `composing`), which opens an underlined box: Enter saves, Shift+Enter
 * starts a new line, Esc closes. The contact page keeps a box with an
 * Add note button.
 */
export function ContactNotes({
  contactId,
  compact,
  composing,
  onComposingChange,
  onChange,
}: {
  contactId: string;
  compact?: boolean;
  /** Compact only: whether the add-a-note box is open. */
  composing?: boolean;
  onComposingChange?: (open: boolean) => void;
  /** A note was added or deleted — e.g. to refresh a timeline. */
  onChange?: () => void;
}) {
  const { notes, authors, saving, add, remove, userId } = useContactNotes(contactId);
  const canWrite = useCan('send-messages');
  const isAdmin = useCan('edit-settings');
  const [draft, setDraft] = useState('');

  const submit = async () => {
    if (await add(draft)) {
      setDraft('');
      onChange?.();
      if (compact) onComposingChange?.(false);
    }
  };

  const del = async (noteId: string) => {
    await remove(noteId);
    onChange?.();
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-4'}>
      {canWrite && compact && composing && (
        // The panel's section is the frame; this has an underline only.
        // As tall as the empty state it replaces, so opening it never
        // makes the section jump.
        <div className="relative">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submit();
              } else if (e.key === 'Escape') {
                setDraft('');
                onComposingChange?.(false);
              }
            }}
            placeholder="Write a note, then press Enter…"
            aria-label="New note"
            maxLength={MAX_NOTE}
            rows={2}
            disabled={saving}
            autoFocus
            className="border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary min-h-[72px] resize-none rounded-none border-0 border-b bg-transparent px-0 pr-5 text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          {saving && (
            <Loader2 className="text-muted-foreground absolute top-1.5 right-0 size-3.5 animate-spin" />
          )}
        </div>
      )}

      {canWrite && !compact && (
        <div className="border-border bg-card rounded-xl border p-4">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // ⌘/Ctrl+Enter saves; Enter alone is a new line.
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Write a note…"
            maxLength={MAX_NOTE}
            rows={3}
            disabled={saving}
            className="bg-background border-border text-foreground placeholder:text-muted-foreground min-h-[80px] resize-none"
          />
          <div className="mt-3 flex justify-end">
            <Button type="button" onClick={() => void submit()} disabled={!draft.trim() || saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              Add note
            </Button>
          </div>
        </div>
      )}

      {notes === null ? (
        <div className="flex justify-center py-6">
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
        </div>
      ) : notes.length === 0 ? (
        compact && composing ? null : (
        <div
          className={cn(
            'text-muted-foreground flex flex-col items-center text-center',
            compact ? 'min-h-[72px] justify-center text-[11px]' : 'border-border rounded-xl border border-dashed py-10 text-sm',
          )}
        >
          <StickyNote className={cn('text-muted-foreground/50 mb-1.5', compact ? 'size-5' : 'size-6')} />
          No notes yet.
        </div>
        )
      ) : (
        <ul className={compact ? 'space-y-1.5' : 'space-y-2'}>
          {notes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              author={authors[note.user_id]}
              canDelete={canWrite && (note.user_id === userId || isAdmin)}
              onDelete={() => void del(note.id)}
              compact={compact}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
