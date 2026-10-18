// ============================================================
// Custom field types (migration 119) — what each kind of field holds,
// and whether a contact's values are acceptable. Shared by Settings →
// Custom fields (defining a field) and the two contact editors (the
// contact slide-over and the contact page), so a field means the same
// thing everywhere.
//
// Values are stored as text whatever the type: digits for a number,
// YYYY-MM-DD for a date, the chosen option for a dropdown.
// ============================================================

export type CustomFieldType = 'text' | 'number' | 'dropdown' | 'date';

export const CUSTOM_FIELD_TYPES: { value: CustomFieldType; label: string; hint: string }[] = [
  { value: 'text', label: 'Text', hint: 'Any words or characters' },
  { value: 'number', label: 'Number', hint: 'Digits only, e.g. 42 or 3.5' },
  { value: 'dropdown', label: 'Dropdown', hint: 'One choice from a list you set' },
  { value: 'date', label: 'Date', hint: 'Picked from a calendar' },
];

/** Most choices a dropdown may have. */
export const MAX_DROPDOWN_OPTIONS = 50;

export function fieldTypeOf(raw: string | null | undefined): CustomFieldType {
  return CUSTOM_FIELD_TYPES.some((t) => t.value === raw) ? (raw as CustomFieldType) : 'text';
}

export function fieldTypeLabel(raw: string | null | undefined): string {
  const type = fieldTypeOf(raw);
  return CUSTOM_FIELD_TYPES.find((t) => t.value === type)!.label;
}

/** A dropdown's choices, from `field_options.options`. */
export function dropdownOptions(fieldOptions: unknown): string[] {
  const raw = (fieldOptions as { options?: unknown } | null)?.options;
  return Array.isArray(raw) ? raw.filter((o): o is string => typeof o === 'string') : [];
}

/** Tidy a dropdown's choices for saving: trimmed, blanks and repeats gone. */
export function cleanOptions(options: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const o of options) {
    const v = o.trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

/** A real calendar date written YYYY-MM-DD. */
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export interface FieldShape {
  field_name: string;
  field_type: string;
  field_options?: unknown;
  is_required?: boolean | null;
}

/**
 * Why a value doesn't fit its field, or null when it does. An empty
 * value always fits here — whether it may be empty is the mandatory
 * check's business.
 */
export function valueProblem(field: FieldShape, raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  switch (fieldTypeOf(field.field_type)) {
    case 'number':
      return /^-?\d+(\.\d+)?$/.test(value) ? null : `${field.field_name} must be a number`;
    case 'date':
      return isIsoDate(value) ? null : `${field.field_name} must be a date`;
    case 'dropdown':
      return dropdownOptions(field.field_options).includes(value)
        ? null
        : `${field.field_name} must be one of its options`;
    default:
      return null;
  }
}

/**
 * Everything wrong with a contact's values before saving: mandatory
 * fields left empty, then values that don't fit their type. Empty
 * list = fine to save.
 */
export function customValueProblems(
  fields: (FieldShape & { id: string })[],
  values: Record<string, string>,
): string[] {
  const missing = fields
    .filter((f) => f.is_required && !(values[f.id] ?? '').trim())
    .map((f) => f.field_name);
  const problems: string[] = [];
  if (missing.length > 0) problems.push(`Fill in ${missing.join(', ')}`);
  for (const f of fields) {
    const p = valueProblem(f, values[f.id] ?? '');
    if (p) problems.push(p);
  }
  return problems;
}
