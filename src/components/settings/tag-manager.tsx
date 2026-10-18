'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Pencil,
  Plus,
  Search,
  Tag as TagIcon,
  Trash2,
} from 'lucide-react';
import { MdOutlineOpenInNew } from 'react-icons/md';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useCan } from '@/hooks/use-can';
import { docHref } from '@/lib/docs/nav';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Tag } from '@/types';
import { SettingsPanelHead } from './settings-panel-head';

const PRESET_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
];

const NAME_MAX = 40;

/** `#abc` → `#aabbcc`, lower-cased: tags store six-digit hex, which
 *  other screens extend with a two-digit alpha for their tints. */
function toSixDigitHex(hex: string): string {
  const h = hex.toLowerCase();
  return /^#[0-9a-f]{3}$/.test(h)
    ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
    : h;
}
/** tags.description CHECK (migration 118). */
const DESCRIPTION_MAX = 200;

/**
 * A tag drawn as a horizontal price tag: pointed on the left with a
 * punched hole, the name on the body. Solid colours (the tag's colour
 * mixed into the card colour) rather than a translucent tint, so the
 * point and the body — two shapes that overlap — read as one.
 */
export function TagShape({ name, color }: { name: string; color: string }) {
  const fill = `color-mix(in srgb, ${color} 16%, var(--card))`;
  return (
    <span className="relative inline-flex h-7 max-w-full items-center pl-[14px]">
      {/* The point: a square turned 45°, its tip at the left edge. */}
      <span
        aria-hidden
        className="absolute top-1/2 left-[4px] size-[20px] -translate-y-1/2 rotate-45 rounded-[3px]"
        style={{ backgroundColor: fill }}
      />
      <span
        className="relative inline-flex h-full min-w-0 items-center rounded-r-md pr-3 pl-2 text-sm font-medium"
        style={{ backgroundColor: fill, color }}
      >
        <span className="truncate">{name}</span>
      </span>
      {/* The hole. */}
      <span
        aria-hidden
        className="bg-card absolute top-1/2 left-[9px] size-1.5 -translate-y-1/2 rounded-full"
      />
    </span>
  );
}

/**
 * Settings → Tags: colour-coded contact labels. Laid out like Quick
 * replies — search, Delete (for ticked tags) and Create tag above the
 * list, one card per tag with a pencil to edit it. Creating, editing
 * and deleting are admin+ (the tags RLS policies); others browse.
 * Deleting detaches a tag from every contact, so it asks first.
 */
export function TagManager() {
  const supabase = createClient();
  const { user, accountId, loading: authLoading } = useAuth();
  const canEdit = useCan('edit-settings');

  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The create/edit window: `editing` is the tag being edited, or null
  // when creating one.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tag | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchTags(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  async function fetchTags(userId: string) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTags(data || []);
    } catch (err) {
      console.error('Failed to fetch tags:', err);
      toast.error('Failed to load tags');
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q)
    );
  }, [tags, search]);

  const toDelete = useMemo(
    () => tags.filter((t) => selected.has(t.id)),
    [tags, selected]
  );

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(tag: Tag) {
    setEditing(tag);
    setDialogOpen(true);
  }

  /** Create, or update the tag being edited. True on success. */
  async function saveTag(values: {
    name: string;
    color: string;
    description: string;
  }) {
    if (!user || !accountId) {
      toast.error('Not authenticated');
      return false;
    }
    const row = {
      name: values.name.trim(),
      color: values.color,
      description: values.description.trim() || null,
    };
    try {
      if (editing) {
        const { error } = await supabase
          .from('tags')
          .update(row)
          .eq('id', editing.id);
        if (error) throw error;
        setTags((prev) =>
          prev.map((t) => (t.id === editing.id ? { ...t, ...row } : t))
        );
        toast.success('Tag updated');
      } else {
        // account_id is mandatory on every account-scoped insert (NOT
        // NULL + RLS, no DB default).
        const { error } = await supabase
          .from('tags')
          .insert({ ...row, user_id: user.id, account_id: accountId });
        if (error) throw error;
        toast.success('Tag created');
        await fetchTags(user.id);
      }
      setDialogOpen(false);
      return true;
    } catch (err) {
      console.error('Save tag error:', err);
      toast.error(editing ? 'Failed to update tag' : 'Failed to create tag');
      return false;
    }
  }

  async function handleDelete() {
    if (toDelete.length === 0) return;
    try {
      setDeleting(true);
      const ids = toDelete.map((t) => t.id);
      const { error } = await supabase.from('tags').delete().in('id', ids);
      if (error) throw error;

      toast.success(
        ids.length === 1 ? 'Tag deleted' : `${ids.length} tags deleted`
      );
      setTags((prev) => prev.filter((t) => !selected.has(t.id)));
      setSelected(new Set());
      setConfirmDelete(false);
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="animate-in fade-in-50 max-w-3xl space-y-5 duration-200">
      <SettingsPanelHead
        title="Tags"
        description="Colour-coded labels for grouping and filtering contacts and conversations."
        // A clear gap between the header and the search row below it.
        className="mb-8"
        action={
          // The Contacts guide has the Tags section.
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={
              <a
                href={docHref('contacts')}
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
            placeholder="Search tags..."
            aria-label="Search tags"
            // Underline only, as on the other settings lists.
            className="border-border focus-visible:border-primary h-10 rounded-none border-0 border-b bg-transparent pr-0 pl-6 focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-2">
            {/* Grey until tags are ticked; then deletes those. */}
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(true)}
              disabled={selected.size === 0}
              title={
                selected.size === 0 ? 'Tick tags to delete them' : undefined
              }
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
            <Button
              onClick={openCreate}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-10"
            >
              <Plus className="size-4" />
              Create tag
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="text-primary size-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center">
          <TagIcon className="text-muted-foreground/60 size-8" />
          <p className="text-foreground mt-3 text-sm font-medium">
            {tags.length === 0 ? 'No tags yet' : 'No tags match your search'}
          </p>
          {tags.length === 0 && (
            <p className="text-muted-foreground mt-1 max-w-sm text-xs">
              Create one to start grouping contacts and conversations.
            </p>
          )}
        </div>
      ) : (
        // All the tags in one bordered box, a line between rows.
        <ul className="divide-border border-border bg-card divide-y overflow-hidden rounded-xl border">
          {filtered.map((tag) => (
            // Top-aligned so the checkbox and pencil sit level with the
            // tag itself (28px tall), not centred on tag + description.
            <li key={tag.id} className="flex items-start gap-3 px-4 py-3.5">
              {canEdit && (
                <Checkbox
                  checked={selected.has(tag.id)}
                  onCheckedChange={(on) => toggle(tag.id, on)}
                  aria-label={`Select ${tag.name}`}
                  className="mt-1.5"
                />
              )}
              <div className="min-w-0 flex-1">
                <TagShape name={tag.name} color={tag.color} />
                <p
                  className={cn(
                    'mt-1.5 text-sm',
                    tag.description
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/50'
                  )}
                >
                  {tag.description || 'No description'}
                </p>
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openEdit(tag)}
                  title="Edit tag"
                  aria-label={`Edit ${tag.name}`}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  <Pencil className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <TagDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tag={editing}
        onSave={saveTag}
      />

      {/* Delete the ticked tags */}
      <Dialog
        open={confirmDelete}
        onOpenChange={(open) => !deleting && setConfirmDelete(open)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {toDelete.length === 1
                ? 'Delete tag'
                : `Delete ${toDelete.length} tags`}
            </DialogTitle>
            <DialogDescription>
              Delete {toDelete.map((t) => `“${t.name}”`).join(', ')}? This
              removes {toDelete.length === 1 ? 'it' : 'them'} from all contacts
              and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Create a tag, or edit one: name, colour, description, and a preview. */
function TagDialog({
  open,
  onOpenChange,
  tag,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The tag being edited; null to create one. */
  tag: Tag | null;
  onSave: (values: {
    name: string;
    color: string;
    description: string;
  }) => Promise<boolean>;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[3].value);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const isCustom = !PRESET_COLORS.some((c) => c.value === color.toLowerCase());

  // Start from the tag (or a blank one) each time the window opens.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(tag?.name ?? '');
    setColor(tag?.color ?? PRESET_COLORS[3].value);
    setDescription(tag?.description ?? '');
  }, [open, tag]);

  const unchanged =
    tag !== null &&
    name.trim() === tag.name &&
    color === tag.color &&
    description.trim() === (tag.description ?? '');
  const canSave = name.trim().length > 0 && !unchanged && !saving;

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    await onSave({ name, color, description });
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{tag ? 'Edit tag' : 'Create tag'}</DialogTitle>
          <DialogDescription>
            Tags group contacts and conversations, and filter the inbox.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag-name">Name</Label>
            <Input
              id="tag-name"
              placeholder="e.g. Newsletter"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
              disabled={saving}
              maxLength={NAME_MAX}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Colour</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  aria-label={`Use ${c.name}`}
                  aria-pressed={color === c.value}
                  className={cn(
                    'size-7 rounded-md transition-transform hover:scale-110',
                    color === c.value &&
                      'outline-primary outline outline-2 outline-offset-2'
                  )}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}

              {/* Any other colour: a picker with a hex box, behind a
                  swatch that shows the custom colour once one is chosen. */}
              <Popover>
                <PopoverTrigger
                  title="Custom colour"
                  aria-label="Pick a custom colour"
                  className={cn(
                    'flex size-7 items-center justify-center rounded-md transition-transform hover:scale-110',
                    isCustom &&
                      'outline-primary outline outline-2 outline-offset-2'
                  )}
                  style={{
                    background: isCustom
                      ? color
                      : 'conic-gradient(#ef4444, #f59e0b, #10b981, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)',
                  }}
                >
                  {!isCustom && (
                    <Plus className="size-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
                  )}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto gap-3 p-3">
                  <HexColorPicker
                    color={color}
                    onChange={(c) => setColor(c.toLowerCase())}
                  />
                  <div className="flex items-center gap-2">
                    <span
                      className="border-border size-8 shrink-0 rounded-md border"
                      style={{ backgroundColor: color }}
                    />
                    {/* Six digits stored: other screens add a two-digit
                        alpha to the colour for their tints. */}
                    <HexColorInput
                      color={color}
                      onChange={(c) => setColor(toSixDigitHex(c))}
                      prefixed
                      aria-label="Hex colour code"
                      className="border-border focus-visible:border-primary h-8 w-full min-w-0 rounded-md border bg-transparent px-2.5 font-mono text-sm uppercase outline-none"
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="tag-description">
                Description{' '}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <span className="text-muted-foreground text-xs tabular-nums">
                {description.length}/{DESCRIPTION_MAX}
              </span>
            </div>
            <Textarea
              id="tag-description"
              placeholder="When to use it — e.g. Asked about bulk pricing"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              maxLength={DESCRIPTION_MAX}
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Preview</Label>
            <div>
              <TagShape name={name.trim() || 'Tag name'} color={color} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSave}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {tag ? 'Save changes' : 'Create tag'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
