'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Bold,
  CheckCheck,
  Code,
  FileText,
  ImageIcon,
  Italic,
  Library,
  Loader2,
  MessageSquareText,
  Music,
  Paperclip,
  Pencil,
  Play,
  Plus,
  Search,
  Smile,
  Strikethrough,
  Trash2,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react';
import { format } from 'date-fns';

import { createClient } from '@/lib/supabase/client';
import { useCan } from '@/hooks/use-can';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { GatedButton } from '@/components/ui/gated-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MediaLibraryPicker } from '@/components/media/media-library-picker';
import {
  CHAT_MEDIA_BUCKET,
  MEDIA_MAX_BYTES_BY_KIND,
  deleteAccountMedia,
  uploadAccountMedia,
} from '@/lib/storage/upload-media';
import { compressImage } from '@/lib/storage/compress-image';
import { EmojiPicker } from '@/components/inbox/emoji-picker';
import { WaFormattedText } from '@/components/inbox/wa-formatted-text';
import { cn } from '@/lib/utils';
import type { QuickReply } from '@/types';
import { SettingsPanelHead } from './settings-panel-head';
import { docHref } from '@/lib/docs/nav';
import { MdOutlineOpenInNew } from 'react-icons/md';

/** Mirrors the CHECK constraint in migration 052. */
const SHORTCUT_RE = /^[A-Za-z0-9_-]{1,32}$/;
const BODY_MAX = 4096;
/** Meta's caption cap — the text rides on an image, video or document. */
const CAPTION_MAX = 1024;

type AttachmentKind = NonNullable<QuickReply['media_kind']>;

/** The attachment as the editor holds it. `path` only for a file
 *  uploaded here (chat-media); a media-library file has none. */
interface Attachment {
  url: string;
  kind: AttachmentKind;
  name: string;
  path: string | null;
}

/** What the composer's pickers accept (chat-media bucket, migration 023). */
const UPLOAD_KINDS: {
  kind: AttachmentKind;
  label: string;
  icon: LucideIcon;
  accept: string;
}[] = [
  {
    kind: 'image',
    label: 'Images',
    icon: ImageIcon,
    accept: 'image/png,image/jpeg,image/webp',
  },
  {
    kind: 'video',
    label: 'Videos',
    icon: Video,
    accept: 'video/mp4,video/3gpp',
  },
  {
    kind: 'audio',
    label: 'Audio',
    icon: Music,
    accept: 'audio/ogg,audio/mpeg,audio/aac,audio/mp4,audio/amr',
  },
  {
    kind: 'document',
    label: 'Document',
    icon: FileText,
    accept:
      'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain',
  },
];

/** Best-effort delete of a file uploaded for a quick reply. */
function removeUpload(path: string | null | undefined) {
  if (path) void deleteAccountMedia(CHAT_MEDIA_BUCKET, path).catch(() => {});
}

export function QuickRepliesManager() {
  const supabase = createClient();
  const { accountId } = useAuth();
  const canEdit = useCan('send-messages'); // agent+, matches the RLS tier

  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // Ticked rows; deleting goes through these and the bar above the list.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('quick_replies')
      .select('*')
      .order('shortcut', { ascending: true });
    if (error) {
      toast.error('Failed to load quick replies');
    } else {
      setReplies((data as QuickReply[]) ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return replies;
    return replies.filter(
      (r) =>
        r.shortcut.toLowerCase().includes(term) ||
        r.body.toLowerCase().includes(term)
    );
  }, [replies, search]);

  const toDelete = useMemo(
    () => replies.filter((r) => selected.has(r.id)),
    [replies, selected]
  );
  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleDelete() {
    if (toDelete.length === 0) return;
    setDeleting(true);
    const ids = toDelete.map((r) => r.id);
    const { error } = await supabase
      .from('quick_replies')
      .delete()
      .in('id', ids);
    setDeleting(false);
    if (error) {
      toast.error('Failed to delete');
      return;
    }
    toast.success(
      ids.length === 1
        ? 'Quick reply deleted'
        : `${ids.length} quick replies deleted`
    );
    for (const r of toDelete) removeUpload(r.media_path);
    setReplies((prev) => prev.filter((r) => !selected.has(r.id)));
    setSelected(new Set());
    setConfirmDelete(false);
  }

  return (
    <section className="space-y-5">
      <SettingsPanelHead
        title="Quick replies"
        description="Canned replies your team can insert in the inbox by typing '/' followed by the shortcut. Shared across the whole account."
        action={
          // The inbox guide: quick replies are used from its composer.
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={
              <a
                href={docHref('inbox')}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            Documentation
            <MdOutlineOpenInNew className="size-4" />
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quick replies..."
            // Underline only, as in the inbox's search.
            className="border-border focus-visible:border-primary h-10 rounded-none border-0 border-b bg-transparent pr-0 pl-6 focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Washed out until rows are ticked; then deletes those. */}
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(true)}
              disabled={selected.size === 0}
              title={
                selected.size === 0
                  ? 'Tick quick replies to delete them'
                  : undefined
              }
              // Grey while nothing is ticked, plain black once something is.
              className={cn(
                'h-10 disabled:opacity-100',
                selected.size === 0
                  ? 'text-muted-foreground'
                  : 'text-foreground'
              )}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          )}
          <GatedButton
            canAct={canEdit}
            gateReason="create quick replies"
            onClick={() => setCreateOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 shrink-0"
          >
            <Plus className="size-4" />
            Add quick reply
          </GatedButton>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading quick replies…
        </div>
      ) : filtered.length === 0 ? (
        <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center">
          <MessageSquareText className="text-muted-foreground/60 size-8" />
          <p className="text-foreground mt-3 text-sm font-medium">
            {replies.length === 0
              ? 'No quick replies yet'
              : 'No quick replies match your search'}
          </p>
          {replies.length === 0 && (
            <p className="text-muted-foreground mt-1 max-w-sm text-xs">
              Add one and your team can insert it in the inbox by typing{' '}
              <code className="bg-muted rounded px-1 py-0.5">/shortcut</code>.
            </p>
          )}
        </div>
      ) : (
        // No frame around the list: each reply is its own card, with a
        // light border so it still reads on a white page.
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li
              key={r.id}
              className="border-border bg-card flex items-start gap-3 rounded-xl border px-4 py-3"
            >
              {canEdit && (
                <Checkbox
                  checked={selected.has(r.id)}
                  onCheckedChange={(on) => toggle(r.id, on)}
                  aria-label={`Select /${r.shortcut}`}
                  className="mt-0.5"
                />
              )}
              {/* The command on top, what it sends underneath. */}
              <div className="min-w-0 flex-1">
                <code className="text-foreground text-sm font-semibold">
                  /{r.shortcut}
                </code>
                {r.media_url && (
                  <p className="text-foreground mt-1.5 flex items-center gap-1.5 text-xs font-medium">
                    <Paperclip className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="truncate">
                      {r.media_name || r.media_kind}
                    </span>
                  </p>
                )}
                {r.body && (
                  <WaFormattedText
                    text={r.body}
                    className="text-muted-foreground mt-1.5 text-sm"
                  />
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <GatedButton
                  canAct={canEdit}
                  gateReason="edit quick replies"
                  variant="ghost"
                  size="icon-sm"
                  title="Edit"
                  onClick={() => setEditing(r)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="size-4" />
                </GatedButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create / edit */}
      <QuickReplyDialog
        open={createOpen || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditing(null);
          }
        }}
        existing={editing}
        accountId={accountId}
        onSaved={(saved) => {
          setReplies((prev) => {
            const without = prev.filter((r) => r.id !== saved.id);
            return [...without, saved].sort((a, b) =>
              a.shortcut.localeCompare(b.shortcut)
            );
          });
          setCreateOpen(false);
          setEditing(null);
        }}
      />

      {/* Delete confirm */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {toDelete.length === 1
                ? 'Delete quick reply'
                : `Delete ${toDelete.length} quick replies`}
            </DialogTitle>
            <DialogDescription>
              {toDelete.length === 1 ? (
                <>
                  Delete <code>/{toDelete[0]?.shortcut}</code>?
                </>
              ) : (
                <>Delete {toDelete.map((r) => `/${r.shortcut}`).join(', ')}?</>
              )}{' '}
              This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

interface QuickReplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null when creating. */
  existing: QuickReply | null;
  accountId: string | null;
  onSaved: (reply: QuickReply) => void;
}

/** WhatsApp's formatting markers, as the compose toolbar applies them. */
const FORMATS: {
  marker: string;
  label: string;
  icon: LucideIcon;
  key?: string;
}[] = [
  { marker: '*', label: 'Bold', icon: Bold, key: 'b' },
  { marker: '_', label: 'Italic', icon: Italic, key: 'i' },
  { marker: '~', label: 'Strikethrough', icon: Strikethrough },
  { marker: '```', label: 'Monospace', icon: Code },
];

/**
 * Create or edit a quick reply: the /command on top, then the message
 * composed on the left — with WhatsApp's formatting and emoji — and
 * shown on the right exactly as the customer will see it, in an
 * outgoing bubble over the chat wallpaper.
 */
function QuickReplyDialog({
  open,
  onOpenChange,
  existing,
  accountId,
  onSaved,
}: QuickReplyDialogProps) {
  const supabase = createClient();
  const { profile } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [shortcut, setShortcut] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [media, setMedia] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const fileInputs = useRef<
    Partial<Record<AttachmentKind, HTMLInputElement | null>>
  >({});
  // Files uploaded in this sitting and not saved yet: deleted when one
  // replaces another, and when the editor closes without saving.
  const unsaved = useRef<Set<string>>(new Set());

  // Re-seed whenever the dialog opens so a cancelled edit can't leak.
  useEffect(() => {
    if (!open) return;
    setShortcut(existing?.shortcut ?? '');
    setBody(existing?.body ?? '');
    setMedia(
      existing?.media_url && existing.media_kind
        ? {
            url: existing.media_url,
            kind: existing.media_kind,
            name: existing.media_name || existing.media_kind,
            path: existing.media_path ?? null,
          }
        : null
    );
    unsaved.current.clear();
  }, [open, existing]);

  // With an image, video or document the text is its caption, which
  // Meta caps at 1,024; with audio it goes as a message of its own.
  const limit = media && media.kind !== 'audio' ? CAPTION_MAX : BODY_MAX;
  const trimmed = body.trim();
  const shortcutValid = SHORTCUT_RE.test(shortcut);
  const canSave =
    shortcutValid &&
    (trimmed.length > 0 || media !== null) &&
    trimmed.length <= limit &&
    !saving &&
    !uploading;

  /** Close, dropping any file uploaded here that was never saved. */
  function close() {
    for (const path of unsaved.current) removeUpload(path);
    unsaved.current.clear();
    onOpenChange(false);
  }

  function replaceMedia(next: Attachment | null) {
    if (media?.path && unsaved.current.has(media.path)) {
      removeUpload(media.path);
      unsaved.current.delete(media.path);
    }
    setMedia(next);
  }

  async function upload(kind: AttachmentKind, file: File | undefined) {
    if (!file) return;
    // Shrink a photo before checking it against Meta's cap, as the
    // composer does: a 6 MB phone photo usually fits once compressed.
    const staged = kind === 'image' ? await compressImage(file) : file;
    const max = MEDIA_MAX_BYTES_BY_KIND[kind];
    if (staged.size > max) {
      toast.error(
        `That ${kind} is ${(staged.size / 1048576).toFixed(1)} MB — the limit is ${Math.round(max / 1048576)} MB.`
      );
      return;
    }
    setUploading(true);
    try {
      const { publicUrl, path } = await uploadAccountMedia(
        CHAT_MEDIA_BUCKET,
        staged
      );
      unsaved.current.add(path);
      replaceMedia({ url: publicUrl, kind, name: file.name, path });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  /** Replace the selection with `text`, then select [from, to) of it. */
  function replaceSelection(
    text: string,
    selectFrom: number,
    selectTo: number
  ) {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end } = ta;
    const next = (body.slice(0, start) + text + body.slice(end)).slice(
      0,
      BODY_MAX
    );
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + selectFrom, start + selectTo);
    });
  }

  /**
   * Wrap the selection in a marker. WhatsApp only formats text the
   * markers hug, so surrounding spaces stay outside them; with nothing
   * selected the cursor lands between a fresh pair.
   */
  function applyFormat(marker: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const selected = body.slice(ta.selectionStart, ta.selectionEnd);
    const lead = selected.match(/^\s*/)?.[0] ?? '';
    const trail = selected.match(/\s*$/)?.[0] ?? '';
    const core = selected.slice(lead.length, selected.length - trail.length);
    const from = lead.length + marker.length;
    replaceSelection(
      `${lead}${marker}${core}${marker}${trail}`,
      from,
      from + core.length
    );
  }

  function insertEmoji(emoji: string) {
    replaceSelection(emoji, emoji.length, emoji.length);
    setEmojiOpen(false);
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);

    const payload = {
      shortcut: shortcut.trim(),
      body: trimmed,
      media_url: media?.url ?? null,
      media_kind: media?.kind ?? null,
      media_name: media?.name ?? null,
      media_path: media?.path ?? null,
    };

    const query = existing
      ? supabase
          .from('quick_replies')
          .update(payload)
          .eq('id', existing.id)
          .select()
          .single()
      : supabase
          .from('quick_replies')
          .insert({ ...payload, account_id: accountId })
          .select()
          .single();

    const { data, error } = await query;
    setSaving(false);

    if (error) {
      // 23505 = unique_violation on (account_id, lower(shortcut)).
      toast.error(
        error.code === '23505'
          ? `The shortcut "/${payload.shortcut}" is already in use.`
          : 'Failed to save quick reply'
      );
      return;
    }

    // The saved file now belongs to the reply; anything else uploaded
    // here, and a file it used to carry, goes.
    if (media?.path) unsaved.current.delete(media.path);
    for (const path of unsaved.current) removeUpload(path);
    unsaved.current.clear();
    if (existing?.media_path && existing.media_path !== media?.path) {
      removeUpload(existing.media_path);
    }

    toast.success(existing ? 'Quick reply updated' : 'Quick reply created');
    onSaved(data as QuickReply);
  }

  const sender = profile?.full_name?.trim() || profile?.email || 'You';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="border-border border-b px-5 py-4">
          <DialogTitle>
            {existing ? 'Edit quick reply' : 'Quick reply'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            A slash command and the message it inserts in the inbox.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          {/* Command */}
          <div>
            <Label htmlFor="qr-shortcut">Command</Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Type it after a slash (e.g. /meet) while writing a message to
              insert this reply.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-muted-foreground text-base">/</span>
              <Input
                id="qr-shortcut"
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value.replace(/\s/g, ''))}
                placeholder="Enter a slash command (max 32 characters, no spaces)"
                maxLength={32}
                autoComplete="off"
                aria-invalid={shortcut.length > 0 && !shortcutValid}
              />
            </div>
            {shortcut && !shortcutValid && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                Letters, numbers, hyphens and underscores only.
              </p>
            )}
          </div>

          <div className="grid min-h-[380px] flex-1 gap-3 md:grid-cols-2">
            {/* Compose */}
            <div className="border-border flex min-h-0 flex-col overflow-hidden rounded-lg border">
              <div className="border-border bg-muted/60 text-foreground border-b px-4 py-3 text-sm font-medium">
                Compose message
              </div>
              <div className="bg-muted/30 flex min-h-0 flex-1 flex-col p-3">
                <div className="border-border bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border">
                  {(media || uploading) && (
                    <div className="border-border flex items-center gap-3 border-b px-3 py-2">
                      {uploading ? (
                        <span className="text-muted-foreground flex items-center gap-2 text-sm">
                          <Loader2 className="size-4 animate-spin" />
                          Uploading…
                        </span>
                      ) : (
                        media && (
                          <>
                            <AttachmentThumb media={media} />
                            <div className="min-w-0 flex-1">
                              <p className="text-foreground truncate text-sm font-medium">
                                {media.name}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                <span className="capitalize">{media.kind}</span>
                                {media.path ? '' : ' · from media library'}
                                {media.kind === 'audio'
                                  ? ' · the text goes as a message after it'
                                  : ' · the text is its caption'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => replaceMedia(null)}
                              aria-label="Remove attachment"
                              className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-md"
                            >
                              <X className="size-4" />
                            </button>
                          </>
                        )
                      )}
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    id="qr-body"
                    aria-label="Message"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => {
                      if (!(e.metaKey || e.ctrlKey)) return;
                      const f = FORMATS.find(
                        (x) => x.key === e.key.toLowerCase()
                      );
                      if (f) {
                        e.preventDefault();
                        applyFormat(f.marker);
                      }
                    }}
                    placeholder="Message…"
                    maxLength={BODY_MAX}
                    className="text-foreground placeholder:text-muted-foreground min-h-[220px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none"
                  />
                  <div className="border-border flex items-center gap-0.5 border-t px-2 py-1.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        title="Attach"
                        aria-label="Attach"
                        disabled={uploading}
                        className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center rounded-md transition-colors disabled:opacity-50"
                      >
                        <Paperclip className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        side="top"
                        align="start"
                        className="min-w-44 p-1"
                      >
                        <DropdownMenuItem
                          onClick={() => setLibraryOpen(true)}
                          className="gap-2.5 px-2.5 py-2"
                        >
                          <Library className="text-muted-foreground size-4" />
                          Media library
                        </DropdownMenuItem>
                        {UPLOAD_KINDS.map((k) => (
                          <DropdownMenuItem
                            key={k.kind}
                            onClick={() => fileInputs.current[k.kind]?.click()}
                            className="gap-2.5 px-2.5 py-2"
                          >
                            <k.icon className="text-muted-foreground size-4" />
                            {k.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {UPLOAD_KINDS.map((k) => (
                      <input
                        key={k.kind}
                        ref={(el) => {
                          fileInputs.current[k.kind] = el;
                        }}
                        type="file"
                        accept={k.accept}
                        className="hidden"
                        onChange={(e) => {
                          void upload(k.kind, e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    ))}
                    <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                      <PopoverTrigger
                        title="Emoji"
                        aria-label="Emoji"
                        className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center rounded-md transition-colors"
                      >
                        <Smile className="size-4" />
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        sideOffset={6}
                        className="w-auto gap-0 p-0"
                      >
                        <EmojiPicker onPick={insertEmoji} />
                      </PopoverContent>
                    </Popover>
                    {FORMATS.map((f) => (
                      <button
                        key={f.marker}
                        type="button"
                        // Keep the textarea's selection: a focus change
                        // on mousedown would collapse it first.
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyFormat(f.marker)}
                        title={
                          f.key
                            ? `${f.label} (Ctrl+${f.key.toUpperCase()})`
                            : f.label
                        }
                        aria-label={f.label}
                        className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center rounded-md transition-colors"
                      >
                        <f.icon className="size-4" />
                      </button>
                    ))}
                    <span
                      className={cn(
                        'ml-auto pr-1 text-xs tabular-nums',
                        trimmed.length > limit
                          ? 'text-red-600'
                          : 'text-muted-foreground'
                      )}
                      title={
                        limit === CAPTION_MAX
                          ? 'Captions can be up to 1,024 characters.'
                          : undefined
                      }
                    >
                      {body.length}/{limit}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="border-border flex min-h-0 flex-col overflow-hidden rounded-lg border">
              <div className="border-border bg-muted/60 text-foreground border-b px-4 py-3 text-sm font-medium">
                Preview message
              </div>
              <div className="bg-background min-h-0 flex-1 overflow-y-auto bg-[url('/inbox-doodle.svg')] bg-repeat p-4">
                {/* WhatsApp's outgoing bubble — the same green the inbox uses.
                    Audio can't carry a caption, so its text is a second
                    bubble, as it will be in the chat. */}
                <div className="space-y-1.5">
                  {!media && !trimmed ? (
                    <PreviewBubble sender={sender}>
                      <p className="text-sm text-[#111b21]/45 italic dark:text-[#e9edef]/50">
                        Your message will appear here
                      </p>
                    </PreviewBubble>
                  ) : (
                    <>
                      {media && (
                        <PreviewBubble sender={sender}>
                          <PreviewMedia media={media} />
                          {media.kind !== 'audio' && trimmed && (
                            <WaFormattedText
                              text={body}
                              className="mt-1.5 text-sm leading-relaxed"
                            />
                          )}
                        </PreviewBubble>
                      )}
                      {trimmed && (!media || media.kind === 'audio') && (
                        <PreviewBubble sender={sender}>
                          <WaFormattedText
                            text={body}
                            className="text-sm leading-relaxed"
                          />
                        </PreviewBubble>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 px-5 py-3">
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {existing ? 'Save changes' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>

      <MediaLibraryPicker
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        kind="any"
        onSelect={(item) =>
          replaceMedia({
            url: item.public_url,
            kind: item.kind,
            name: item.name,
            path: null,
          })
        }
      />
    </Dialog>
  );
}

/** A small square for the attachment card: the photo, or its kind's icon. */
function AttachmentThumb({ media }: { media: Attachment }) {
  if (media.kind === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={media.url}
        alt=""
        className="size-10 shrink-0 rounded-md object-cover"
      />
    );
  }
  const Icon =
    UPLOAD_KINDS.find((k) => k.kind === media.kind)?.icon ?? FileText;
  return (
    <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
      <Icon className="size-5" />
    </span>
  );
}

/** One outgoing bubble in the preview, with WhatsApp's footer line. */
function PreviewBubble({
  sender,
  children,
}: {
  sender: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-fit max-w-[85%] min-w-40 rounded-lg bg-[#d9fdd3] px-2 pt-2 pb-1.5 text-[#111b21] shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:bg-[#005c4b] dark:text-[#e9edef]">
      <div className="px-1">{children}</div>
      <div className="mt-1 flex items-center justify-end gap-1.5 px-1 text-[11px] text-[#667781] dark:text-[#e9edef]/60">
        <span className="max-w-[12rem] truncate">{sender}</span>
        <span>·</span>
        <span>{format(new Date(), 'HH:mm')}</span>
        <CheckCheck className="size-3.5 text-[#53bdeb]" />
      </div>
    </div>
  );
}

/** The attachment as WhatsApp shows it in a chat. */
function PreviewMedia({ media }: { media: Attachment }) {
  switch (media.kind) {
    case 'image':
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.url}
          alt=""
          className="max-h-64 w-full rounded-md object-cover"
        />
      );
    case 'video':
      return (
        <div className="relative overflow-hidden rounded-md bg-black">
          <video
            src={media.url}
            muted
            preload="metadata"
            className="max-h-64 w-full"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-black/50 text-white">
              <Play className="size-5 fill-current" />
            </span>
          </span>
        </div>
      );
    case 'audio':
      return (
        <div className="flex w-60 items-center gap-2.5 py-1">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white">
            <Play className="size-4 fill-current" />
          </span>
          <span className="h-1 flex-1 rounded-full bg-[#111b21]/20 dark:bg-white/25" />
        </div>
      );
    default:
      return (
        <div className="flex items-center gap-2.5 rounded-md bg-black/5 px-2.5 py-2 dark:bg-white/10">
          <FileText className="size-7 shrink-0 text-[#53bdeb]" />
          <span className="min-w-0 truncate text-sm font-medium">
            {media.name}
          </span>
        </div>
      );
  }
}
