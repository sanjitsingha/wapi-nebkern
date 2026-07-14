'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, MessageSquareText, Pencil, Plus, Search, Trash2 } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useCan } from '@/hooks/use-can';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { GatedButton } from '@/components/ui/gated-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { QuickReply } from '@/types';
import { SettingsPanelHead } from './settings-panel-head';

/** Mirrors the CHECK constraint in migration 052. */
const SHORTCUT_RE = /^[A-Za-z0-9_-]{1,32}$/;
const BODY_MAX = 4096;

export function QuickRepliesManager() {
  const supabase = createClient();
  const { accountId } = useAuth();
  const canEdit = useCan('send-messages'); // agent+, matches the RLS tier

  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QuickReply | null>(null);
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
        r.body.toLowerCase().includes(term),
    );
  }, [replies, search]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase
      .from('quick_replies')
      .delete()
      .eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error('Failed to delete quick reply');
      return;
    }
    toast.success('Quick reply deleted');
    setReplies((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  return (
    <section className="space-y-5">
      <SettingsPanelHead
        title="Quick replies"
        description="Canned replies your team can insert in the inbox by typing '/' followed by the shortcut. Shared across the whole account."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quick replies..."
            className="h-10 border-border bg-card pl-8"
          />
        </div>
        <GatedButton
          canAct={canEdit}
          gateReason="create quick replies"
          onClick={() => setCreateOpen(true)}
          className="h-10 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" />
          Add quick reply
        </GatedButton>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading quick replies…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <MessageSquareText className="size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {replies.length === 0
              ? 'No quick replies yet'
              : 'No quick replies match your search'}
          </p>
          {replies.length === 0 && (
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Add one and your team can insert it in the inbox by typing{' '}
              <code className="rounded bg-muted px-1 py-0.5">/shortcut</code>.
            </p>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {filtered.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <code className="mt-0.5 shrink-0 rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                /{r.shortcut}
              </code>
              <p className="min-w-0 flex-1 text-sm whitespace-pre-wrap text-muted-foreground">
                {r.body}
              </p>
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
                <GatedButton
                  canAct={canEdit}
                  gateReason="delete quick replies"
                  variant="ghost"
                  size="icon-sm"
                  title="Delete"
                  onClick={() => setDeleteTarget(r)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
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
              a.shortcut.localeCompare(b.shortcut),
            );
          });
          setCreateOpen(false);
          setEditing(null);
        }}
      />

      {/* Delete confirm */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete quick reply</DialogTitle>
            <DialogDescription>
              Delete <code>/{deleteTarget?.shortcut}</code>? This can&apos;t be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
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

function QuickReplyDialog({
  open,
  onOpenChange,
  existing,
  accountId,
  onSaved,
}: QuickReplyDialogProps) {
  const supabase = createClient();
  const [shortcut, setShortcut] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  // Re-seed whenever the dialog opens so a cancelled edit can't leak.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShortcut(existing?.shortcut ?? '');
    setBody(existing?.body ?? '');
  }, [open, existing]);

  const shortcutValid = SHORTCUT_RE.test(shortcut);
  const canSave = shortcutValid && body.trim().length > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);

    const payload = { shortcut: shortcut.trim(), body: body.trim() };

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
          : 'Failed to save quick reply',
      );
      return;
    }

    toast.success(existing ? 'Quick reply updated' : 'Quick reply created');
    onSaved(data as QuickReply);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {existing ? 'Edit quick reply' : 'New quick reply'}
          </DialogTitle>
          <DialogDescription>
            Agents insert this in the inbox by typing / followed by the
            shortcut.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qr-shortcut">Shortcut</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/</span>
              <Input
                id="qr-shortcut"
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                placeholder="thanks"
                autoComplete="off"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {shortcut && !shortcutValid
                ? 'Letters, numbers, hyphens and underscores only (max 32, no spaces).'
                : 'One word — letters, numbers, - and _ only.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qr-body">Message</Label>
            <Textarea
              id="qr-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Thanks for reaching out! We'll get back to you shortly."
              rows={5}
              maxLength={BODY_MAX}
            />
            <p className="text-xs text-muted-foreground">
              {body.length}/{BODY_MAX}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {existing ? 'Save changes' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
