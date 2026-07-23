'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, GripVertical, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FormField, FormFieldType, WhatsAppForm } from '@/types';
import { FLOW_CATEGORIES, FORM_FIELD_TYPES, type FlowCategory } from '@/lib/whatsapp/forms';
import { FormPreview } from './form-preview';

const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  short_text: 'Short text',
  email: 'Email',
  phone: 'Phone number',
  number: 'Number',
  long_text: 'Long text',
  dropdown: 'Dropdown',
  radio: 'Multiple choice (radio)',
  checkbox: 'Checkboxes',
  date: 'Date',
  opt_in: 'Consent checkbox',
};

const CATEGORY_LABELS: Record<FlowCategory, string> = {
  SIGN_UP: 'Sign up',
  SIGN_IN: 'Sign in',
  APPOINTMENT_BOOKING: 'Appointment booking',
  LEAD_GENERATION: 'Lead generation',
  CONTACT_US: 'Contact us',
  CUSTOMER_SUPPORT: 'Customer support',
  SURVEY: 'Survey',
  OTHER: 'Other',
};

const NEEDS_OPTIONS = new Set<FormFieldType>(['dropdown', 'radio', 'checkbox']);

/** Turn a label into a stable field id — letters/numbers/underscore
 *  only, matching the API's validation. Only auto-derived while the
 *  field is new and its id hasn't been hand-edited, so renaming a
 *  label after the fact never silently changes the id customers'
 *  answers are already keyed by. */
function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'field';
}

function newField(): FormField {
  return { id: '', type: 'short_text', label: '', required: true };
}

export function FormBuilder({ initial }: { initial?: WhatsAppForm }) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<FlowCategory>(
    (initial?.categories?.[0] as FlowCategory) ?? 'OTHER',
  );
  const [fields, setFields] = useState<FormField[]>(
    initial?.fields && initial.fields.length > 0 ? initial.fields : [newField()],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(index: number, patch: Partial<FormField>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function handleLabelChange(index: number, label: string) {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        // Only auto-derive the id while it's still empty (a brand-new
        // row) — once an id exists (freshly slugified or loaded from a
        // saved form), typing in the label never touches it again.
        const id = f.id || slugify(label);
        return { ...f, label, id };
      }),
    );
  }

  function addField() {
    setFields((prev) => [...prev, newField()]);
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  function moveField(index: number, dir: -1 | 1) {
    setFields((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addOption(index: number) {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        const options = f.options ?? [];
        const n = options.length + 1;
        return { ...f, options: [...options, { id: `option_${n}`, title: '' }] };
      }),
    );
  }

  function updateOption(fieldIndex: number, optIndex: number, title: string) {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== fieldIndex) return f;
        const options = (f.options ?? []).map((o, j) =>
          j === optIndex ? { ...o, title, id: o.id || slugify(title) } : o,
        );
        return { ...f, options };
      }),
    );
  }

  function removeOption(fieldIndex: number, optIndex: number) {
    setFields((prev) =>
      prev.map((f, i) =>
        i === fieldIndex ? { ...f, options: (f.options ?? []).filter((_, j) => j !== optIndex) } : f,
      ),
    );
  }

  function validate(): string | null {
    if (!name.trim()) return 'Give the form a name.';
    if (fields.length === 0) return 'Add at least one field.';
    for (const f of fields) {
      if (!f.label.trim()) return 'Every field needs a label.';
      if (NEEDS_OPTIONS.has(f.type) && (!f.options || f.options.length === 0)) {
        return `"${f.label}" needs at least one option.`;
      }
      if (NEEDS_OPTIONS.has(f.type) && f.options?.some((o) => !o.title.trim())) {
        return `"${f.label}" has an option with no text.`;
      }
    }
    return null;
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const url = isEdit ? `/api/whatsapp/forms/${initial!.id}` : '/api/whatsapp/forms';
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, categories: [category], fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Save failed (HTTP ${res.status})`);
      toast.success(isEdit ? 'Form updated' : 'Form created as a draft');
      router.push('/forms');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save form');
    } finally {
      setSaving(false);
    }
  }

  const locked = isEdit && initial?.status !== 'DRAFT';

  return (
    <section className="animate-in fade-in-50 mx-auto max-w-6xl space-y-6 duration-200">
      <div className="border-border flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            {isEdit ? 'Edit form' : 'New form'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            A form opens inside WhatsApp itself — the customer never leaves the chat to answer it.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/forms')}>
          Cancel
        </Button>
      </div>

      {locked && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertCircle className="size-4 shrink-0" />
          This form is published and can no longer be edited — publishing locks its structure on
          Meta&apos;s side. Create a new form for any changes.
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="form-name">Form name</Label>
            <Input
              id="form-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Book a demo"
              disabled={locked}
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="form-category">Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory((v ?? 'OTHER') as FlowCategory)}
              disabled={locked}
            >
              <SelectTrigger id="form-category" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FLOW_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base">Fields</Label>
          {!locked && (
            <Button variant="outline" size="sm" onClick={addField}>
              <Plus className="size-4" />
              Add field
            </Button>
          )}
        </div>

        {fields.map((field, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-start gap-3">
                <GripVertical className="text-muted-foreground/40 mt-3 size-4 shrink-0" />
                <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_auto]">
                  <Input
                    value={field.label}
                    onChange={(e) => handleLabelChange(index, e.target.value)}
                    placeholder="Field label, e.g. Full name"
                    disabled={locked}
                    className="h-11"
                  />
                  <Select
                    value={field.type}
                    onValueChange={(v) => updateField(index, { type: (v ?? 'short_text') as FormFieldType })}
                    disabled={locked}
                  >
                    <SelectTrigger className="h-11 w-full sm:w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORM_FIELD_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {FIELD_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1 pt-2.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={index === 0}
                    onClick={() => moveField(index, -1)}
                    aria-label="Move up"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={index === fields.length - 1}
                    onClick={() => moveField(index, 1)}
                    aria-label="Move down"
                  >
                    ↓
                  </Button>
                  {!locked && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-red-500 size-8"
                      onClick={() => removeField(index)}
                      aria-label="Remove field"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>

              <label className="text-muted-foreground flex items-center gap-2 pl-7 text-sm">
                <Checkbox
                  checked={field.required}
                  onCheckedChange={(v) => updateField(index, { required: Boolean(v) })}
                  disabled={locked}
                />
                Required
              </label>

              {NEEDS_OPTIONS.has(field.type) && (
                <div className="space-y-2 pl-7">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Options
                  </p>
                  {(field.options ?? []).map((opt, optIndex) => (
                    <div key={optIndex} className="flex items-center gap-2">
                      <Input
                        value={opt.title}
                        onChange={(e) => updateOption(index, optIndex, e.target.value)}
                        placeholder={`Option ${optIndex + 1}`}
                        disabled={locked}
                        className="h-10"
                      />
                      {!locked && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-red-500 size-8 shrink-0"
                          onClick={() => removeOption(index, optIndex)}
                          aria-label="Remove option"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {!locked && (
                    <Button variant="outline" size="sm" onClick={() => addOption(index)}>
                      <Plus className="size-3.5" />
                      Add option
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {isEdit && initial && initial.validation_errors?.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
          <p className="font-medium">Meta reported validation issues:</p>
          <pre className="mt-1 overflow-x-auto text-xs whitespace-pre-wrap">
            {JSON.stringify(initial.validation_errors, null, 2)}
          </pre>
        </div>
      )}

      {!locked && (
        <div className="flex justify-end gap-2 pb-8">
          <Button variant="outline" onClick={() => router.push('/forms')}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="h-11">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create form'}
          </Button>
        </div>
      )}
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
          How it looks in WhatsApp
        </p>
        <FormPreview formName={name} fields={fields} />
      </div>
      </div>
    </section>
  );
}
