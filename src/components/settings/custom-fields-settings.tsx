'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  CalendarDays,
  Hash,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Search,
  TextCursorInput,
  Trash2,
  Type,
  X,
  type LucideIcon,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useCan } from '@/hooks/use-can';
import { docHref } from '@/lib/docs/nav';
import {
  CUSTOM_FIELD_TYPES,
  MAX_DROPDOWN_OPTIONS,
  cleanOptions,
  dropdownOptions,
  fieldTypeLabel,
  fieldTypeOf,
  type CustomFieldType,
} from '@/lib/contacts/custom-field-types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DocsButton } from '@/components/ui/docs-button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CustomField } from '@/types';
import { SettingsPanelHead } from './settings-panel-head';

const NAME_MAX = 60;
const OPTION_MAX = 60;

const TYPE_ICON: Record<CustomFieldType, LucideIcon> = {
  text: Type,
  number: Hash,
  dropdown: ListChecks,
  date: CalendarDays,
};

/** What the add/edit window hands back to be saved. */
interface FieldDraft {
  name: string;
  type: CustomFieldType;
  /** Dropdown choices, already tidied; empty for other types. */
  options: string[];
  required: boolean;
}

/**
 * Settings → Custom fields: the account-wide catalogue of extra contact
 * fields. Laid out like Tags and Quick replies — search, Delete (for
 * ticked fields) and Add field above one bordered list, a pencil per
 * row to edit. Each field has a type (text, number, dropdown, date —
 * see lib/contacts/custom-field-types.ts) and may be mandatory. Admin+
 * to change anything (`custom_fields` RLS); other roles see the list
 * read-only.
 *
 * The Contacts page keeps its own compact dialog for the same catalogue
 * (contacts/custom-fields-manager.tsx).
 */
export function CustomFieldsSettings() {
  const supabase = createClient();
  const { user, accountId } = useAuth();
  const canEdit = useCan('edit-settings');

  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The add/edit window: `editing` is the field being edited, or null
  // when adding one.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomField | null>(null);

  const fetchFields = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('custom_fields')
      .select('*')
      .order('field_name');
    if (error) toast.error('Failed to load custom fields');
    setFields((data as CustomField[] | null) ?? []);
    setLoading(false);
  }, [supabase, accountId]);

  useEffect(() => {
    // The setters run after the Supabase await, not synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (accountId) void fetchFields();
  }, [accountId, fetchFields]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? fields.filter((f) => f.field_name.toLowerCase().includes(q))
      : fields;
  }, [fields, search]);

  const toDelete = useMemo(
    () => fields.filter((f) => selected.has(f.id)),
    [fields, selected]
  );

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** Case-insensitive name clash with another field. */
  function isDuplicate(name: string, exceptId?: string) {
    const lower = name.toLowerCase();
    return fields.some(
      (f) => f.id !== exceptId && f.field_name.toLowerCase() === lower
    );
  }

  /** Add a field, or save the one being edited. True on success. */
  async function saveField(draft: FieldDraft): Promise<boolean> {
    const name = draft.name.trim();
    if (!name) return false;
    if (isDuplicate(name, editing?.id)) {
      toast.error(`A field named "${name}" already exists.`);
      return false;
    }
    const isDropdown = draft.type === 'dropdown';
    if (editing) {
      // The type is fixed once a field exists — contacts' values were
      // written for it — so only the name, options and mandatory change.
      const { error } = await supabase
        .from('custom_fields')
        .update({
          field_name: name,
          is_required: draft.required,
          ...(isDropdown ? { field_options: { options: draft.options } } : {}),
        })
        .eq('id', editing.id);
      if (error) {
        toast.error('Could not save the field.');
        return false;
      }
      toast.success('Field saved');
    } else {
      if (!accountId || !user) {
        toast.error('Your profile is not linked to an account.');
        return false;
      }
      const { error } = await supabase.from('custom_fields').insert({
        field_name: name,
        field_type: draft.type,
        field_options: isDropdown ? { options: draft.options } : null,
        is_required: draft.required,
        user_id: user.id,
        account_id: accountId,
      });
      if (error) {
        toast.error('Could not create the field. You may not have permission.');
        return false;
      }
      toast.success(`Added "${name}"`);
    }
    setDialogOpen(false);
    await fetchFields();
    return true;
  }

  async function handleDelete() {
    if (toDelete.length === 0) return;
    setDeleting(true);
    const ids = toDelete.map((f) => f.id);
    const { error } = await supabase
      .from('custom_fields')
      .delete()
      .in('id', ids);
    setDeleting(false);
    if (error) {
      toast.error('Could not delete.');
      return;
    }
    toast.success(
      ids.length === 1 ? 'Field deleted' : `${ids.length} fields deleted`
    );
    setFields((prev) => prev.filter((f) => !selected.has(f.id)));
    setSelected(new Set());
    setConfirmDelete(false);
  }

  return (
    <section className="animate-in fade-in-50 max-w-3xl space-y-5 duration-200">
      <SettingsPanelHead
        title="Custom fields"
        description="Extra contact fields (e.g. ZIP code, lead source). They appear on every contact, in segments, and in the “Update Contact Field” automation action."
        className="mb-8"
        action={
          // The Contacts guide has the Custom fields section.
          <DocsButton href={docHref('contacts')} />
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fields..."
            aria-label="Search custom fields"
            // Underline only, as on the other settings lists.
            className="border-border focus-visible:border-primary h-10 rounded-none border-0 border-b bg-transparent pr-0 pl-6 focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-2">
            {/* Grey until fields are ticked; then deletes those. */}
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(true)}
              disabled={selected.size === 0}
              title={
                selected.size === 0 ? 'Tick fields to delete them' : undefined
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
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-10"
            >
              <Plus className="size-4" />
              Add field
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
          <TextCursorInput className="text-muted-foreground/60 size-8" />
          <p className="text-foreground mt-3 text-sm font-medium">
            {fields.length === 0
              ? 'No custom fields yet'
              : 'No fields match your search'}
          </p>
          {fields.length === 0 && (
            <p className="text-muted-foreground mt-1 max-w-sm text-xs">
              Add one to keep extra details — like ZIP code or lead source — on
              every contact.
            </p>
          )}
        </div>
      ) : (
        // All the fields in one bordered box, a line between rows.
        <ul className="divide-border border-border bg-card divide-y overflow-hidden rounded-xl border">
          {filtered.map((field) => {
            const type = fieldTypeOf(field.field_type);
            const TypeIcon = TYPE_ICON[type];
            const optionCount = dropdownOptions(field.field_options).length;
            return (
              <li
                key={field.id}
                className="flex items-center gap-3 px-4 py-3.5"
              >
                {canEdit && (
                  <Checkbox
                    checked={selected.has(field.id)}
                    onCheckedChange={(on) => toggle(field.id, on)}
                    aria-label={`Select ${field.field_name}`}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-foreground flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{field.field_name}</span>
                    {field.is_required && (
                      <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400">
                        Mandatory
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                    <TypeIcon className="size-3.5" />
                    {fieldTypeLabel(type)}
                    {type === 'dropdown' &&
                      ` · ${optionCount} ${optionCount === 1 ? 'option' : 'options'}`}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setEditing(field);
                      setDialogOpen(true);
                    }}
                    title="Edit field"
                    aria-label={`Edit ${field.field_name}`}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <FieldDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        field={editing}
        onSave={saveField}
      />

      {/* Delete the ticked fields */}
      <Dialog
        open={confirmDelete}
        onOpenChange={(open) => !deleting && setConfirmDelete(open)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {toDelete.length === 1
                ? 'Delete field'
                : `Delete ${toDelete.length} fields`}
            </DialogTitle>
            <DialogDescription>
              Delete {toDelete.map((f) => `“${f.field_name}”`).join(', ')}? This
              also removes {toDelete.length === 1 ? 'its' : 'their'} stored
              value on every contact and cannot be undone.
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

/** One dropdown choice being edited; `key` keeps React rows stable. */
interface OptionRow {
  key: number;
  value: string;
}

interface FieldForm {
  name: string;
  /** Null until a type is chosen for a new field. */
  type: CustomFieldType | null;
  options: OptionRow[];
  required: boolean;
  /** The option row just added, so it takes the cursor. */
  focusKey: number | null;
}

/** Add a field, or edit one: name, type, dropdown options, mandatory. */
function FieldDialog({
  open,
  onOpenChange,
  field,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The field being edited; null to add one. */
  field: CustomField | null;
  onSave: (draft: FieldDraft) => Promise<boolean>;
}) {
  const nextKey = useRef(0);
  const [form, setForm] = useState<FieldForm>({
    name: '',
    type: null,
    options: [],
    required: false,
    focusKey: null,
  });
  const [saving, setSaving] = useState(false);

  const row = (value: string): OptionRow => ({
    key: nextKey.current++,
    value,
  });

  // Start from the field (or blank) each time the window opens.
  useEffect(() => {
    if (!open) return;
    const saved = dropdownOptions(field?.field_options);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      name: field?.field_name ?? '',
      type: field ? fieldTypeOf(field.field_type) : null,
      options: (saved.length > 0 ? saved : ['']).map(row),
      required: Boolean(field?.is_required),
      focusKey: null,
    });
  }, [open, field]);

  const isDropdown = form.type === 'dropdown';
  const TypeIcon = form.type ? TYPE_ICON[form.type] : null;
  const options = cleanOptions(form.options.map((o) => o.value));
  const name = form.name.trim();

  const changed =
    !field ||
    name !== field.field_name ||
    form.required !== Boolean(field.is_required) ||
    (isDropdown &&
      options.join('\n') !== dropdownOptions(field.field_options).join('\n'));

  const canSave =
    !saving &&
    name.length > 0 &&
    form.type !== null &&
    (!isDropdown || options.length > 0) &&
    changed;

  function setOption(key: number, value: string) {
    setForm((f) => ({
      ...f,
      options: f.options.map((o) => (o.key === key ? { ...o, value } : o)),
    }));
  }

  /** A blank option row after `afterKey` (or at the end), focused. */
  function addOption(afterKey?: number) {
    setForm((f) => {
      if (f.options.length >= MAX_DROPDOWN_OPTIONS) return f;
      const fresh = row('');
      const at =
        afterKey === undefined
          ? f.options.length
          : f.options.findIndex((o) => o.key === afterKey) + 1;
      const next = [...f.options];
      next.splice(at, 0, fresh);
      return { ...f, options: next, focusKey: fresh.key };
    });
  }

  function removeOption(key: number) {
    setForm((f) => {
      const next = f.options.filter((o) => o.key !== key);
      // Keep one row to type into.
      return { ...f, options: next.length > 0 ? next : [row('')] };
    });
  }

  async function submit() {
    if (!canSave || !form.type) return;
    setSaving(true);
    await onSave({
      name,
      type: form.type,
      options: isDropdown ? options : [],
      required: form.required,
    });
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{field ? 'Edit field' : 'Add field'}</DialogTitle>
          <DialogDescription>
            {field
              ? 'Values already stored on contacts stay as they are.'
              : 'Every contact gets this field, empty until you fill it in.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* No labels above these two: the placeholders say what goes in. */}
          <div className="space-y-3">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
              placeholder="Field name"
              aria-label="Field name"
              maxLength={NAME_MAX}
              disabled={saving}
              className="h-10"
              autoFocus
            />
            <Select
              value={form.type}
              onValueChange={(v) =>
                v &&
                setForm((f) => ({
                  ...f,
                  type: v as CustomFieldType,
                  focusKey: null,
                }))
              }
              disabled={Boolean(field) || saving}
            >
              <SelectTrigger
                aria-label="Field type"
                className="border-border w-full bg-transparent data-[size=default]:h-10"
              >
                <SelectValue>
                  {form.type && TypeIcon ? (
                    <span className="flex items-center gap-2">
                      <TypeIcon className="text-muted-foreground size-4" />
                      {fieldTypeLabel(form.type)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Choose type</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start" alignItemWithTrigger={false}>
                {CUSTOM_FIELD_TYPES.map((t) => {
                  const Icon = TYPE_ICON[t.value];
                  return (
                    <SelectItem key={t.value} value={t.value} className="py-2">
                      <span className="flex items-start gap-2.5">
                        <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                        <span className="flex flex-col gap-0.5">
                          <span className="text-foreground text-sm font-medium">
                            {t.label}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {t.hint}
                          </span>
                        </span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {field && (
              <p className="text-muted-foreground text-xs">
                The type can&apos;t be changed after the field is created.
              </p>
            )}
          </div>

          {isDropdown && (
            <div className="space-y-2">
              <p className="text-foreground text-sm font-medium">Options</p>
              <ul className="max-h-56 space-y-2 overflow-y-auto">
                {form.options.map((o, i) => (
                  <li key={o.key} className="flex items-center gap-2">
                    <Input
                      value={o.value}
                      onChange={(e) => setOption(o.key, e.target.value)}
                      onKeyDown={(e) => {
                        // Enter starts the next option, as in a list.
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addOption(o.key);
                        }
                      }}
                      placeholder={`Option ${i + 1}`}
                      maxLength={OPTION_MAX}
                      disabled={saving}
                      autoFocus={o.key === form.focusKey}
                      aria-label={`Option ${i + 1}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeOption(o.key)}
                      disabled={saving}
                      aria-label={`Remove option ${i + 1}`}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              {form.options.length < MAX_DROPDOWN_OPTIONS && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addOption()}
                  disabled={saving}
                  className="text-muted-foreground hover:text-foreground -ml-2"
                >
                  <Plus className="size-4" />
                  Add option
                </Button>
              )}
            </div>
          )}

          <div className="border-border flex items-center justify-between gap-4 border-t pt-4">
            <div>
              <p
                id="field-required"
                className="text-foreground text-sm font-medium"
              >
                Mandatory
              </p>
              <p className="text-muted-foreground text-xs">
                Contacts can&apos;t be saved with this field empty.
              </p>
            </div>
            <Switch
              checked={form.required}
              onCheckedChange={(on) => setForm((f) => ({ ...f, required: on }))}
              disabled={saving}
              aria-labelledby="field-required"
            />
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
            {field ? 'Save' : 'Add field'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
