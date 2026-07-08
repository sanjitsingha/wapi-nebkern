// Field catalog for the Segment rule builder. This is the single source
// of truth shared by the builder UI (which fields/operators to offer) and
// mirrors the operator ids the SQL compiler in migration 043 understands.
// Adding a new filterable field is a two-line change here plus a handler
// in `_segment_leaf_sql` — the "future compatible" seam from the spec.

import type { CustomField } from '@/types';

/** How the value input for a rule should render. */
export type ValueKind = 'text' | 'date' | 'boolean' | 'tag' | 'list';

export interface OperatorDef {
  id: string;
  label: string;
  /** When false, the operator is self-contained (e.g. "Is set", "Today")
   *  and the value input is hidden. */
  needsValue: boolean;
}

export interface FieldDef {
  key: string;
  label: string;
  category: string;
  valueKind: ValueKind;
  operators: OperatorDef[];
}

// ── Operator sets by field type ──────────────────────────────────────
export const TEXT_OPS: OperatorDef[] = [
  { id: 'equals', label: 'Equals', needsValue: true },
  { id: 'not_equals', label: 'Not equals', needsValue: true },
  { id: 'contains', label: 'Contains', needsValue: true },
  { id: 'not_contains', label: 'Does not contain', needsValue: true },
  { id: 'starts_with', label: 'Starts with', needsValue: true },
  { id: 'ends_with', label: 'Ends with', needsValue: true },
  { id: 'is_set', label: 'Is set', needsValue: false },
  { id: 'is_not_set', label: 'Is not set', needsValue: false },
];

export const DATE_OPS: OperatorDef[] = [
  { id: 'before', label: 'Before', needsValue: true },
  { id: 'after', label: 'After', needsValue: true },
  { id: 'today', label: 'Today', needsValue: false },
  { id: 'yesterday', label: 'Yesterday', needsValue: false },
  { id: 'last_7_days', label: 'Last 7 days', needsValue: false },
  { id: 'last_30_days', label: 'Last 30 days', needsValue: false },
  { id: 'this_month', label: 'This month', needsValue: false },
  { id: 'last_month', label: 'Last month', needsValue: false },
];

export const BOOL_OPS: OperatorDef[] = [
  { id: 'is_true', label: 'Yes', needsValue: false },
  { id: 'is_false', label: 'No', needsValue: false },
];

export const TAG_OPS: OperatorDef[] = [
  { id: 'has_tag', label: 'Has tag', needsValue: true },
  { id: 'not_has_tag', label: 'Does not have tag', needsValue: true },
];

export const LIST_OPS: OperatorDef[] = [
  { id: 'in_list', label: 'In list', needsValue: true },
  { id: 'not_in_list', label: 'Not in list', needsValue: true },
];

// Custom values are stored as text, so they get the text-ish subset the
// compiler supports for `custom:*` fields.
export const CUSTOM_OPS: OperatorDef[] = [
  { id: 'equals', label: 'Equals', needsValue: true },
  { id: 'not_equals', label: 'Not equals', needsValue: true },
  { id: 'contains', label: 'Contains', needsValue: true },
  { id: 'is_set', label: 'Is set', needsValue: false },
  { id: 'is_not_set', label: 'Is not set', needsValue: false },
];

// ── Static field catalog ─────────────────────────────────────────────
export const STATIC_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', category: 'Contact', valueKind: 'text', operators: TEXT_OPS },
  { key: 'phone', label: 'Phone', category: 'Contact', valueKind: 'text', operators: TEXT_OPS },
  { key: 'email', label: 'Email', category: 'Contact', valueKind: 'text', operators: TEXT_OPS },
  { key: 'company', label: 'Company', category: 'Contact', valueKind: 'text', operators: TEXT_OPS },
  { key: 'city', label: 'City', category: 'Contact', valueKind: 'text', operators: TEXT_OPS },
  { key: 'state', label: 'State', category: 'Contact', valueKind: 'text', operators: TEXT_OPS },
  { key: 'pin_code', label: 'PIN code', category: 'Contact', valueKind: 'text', operators: TEXT_OPS },
  { key: 'marketing_enabled', label: 'Marketing enabled', category: 'Marketing', valueKind: 'boolean', operators: BOOL_OPS },
  { key: 'tag', label: 'Tag', category: 'Tags', valueKind: 'tag', operators: TAG_OPS },
  { key: 'list', label: 'List', category: 'Lists', valueKind: 'list', operators: LIST_OPS },
  { key: 'created_at', label: 'Created date', category: 'Activity', valueKind: 'date', operators: DATE_OPS },
  { key: 'updated_at', label: 'Last updated', category: 'Activity', valueKind: 'date', operators: DATE_OPS },
];

const CUSTOM_PREFIX = 'custom:';

/** A field key like "custom:<uuid>" maps to a user-defined custom field. */
export function customFieldKey(id: string): string {
  return `${CUSTOM_PREFIX}${id}`;
}

/**
 * Merge the static catalog with the account's custom fields (each exposed
 * under a `custom:<id>` key). Called with the fields fetched at runtime.
 */
export function buildFieldCatalog(customFields: CustomField[]): FieldDef[] {
  const custom: FieldDef[] = customFields.map((cf) => ({
    key: customFieldKey(cf.id),
    label: cf.field_name,
    category: 'Custom fields',
    valueKind: 'text',
    operators: CUSTOM_OPS,
  }));
  return [...STATIC_FIELDS, ...custom];
}

export function findField(catalog: FieldDef[], key: string): FieldDef | undefined {
  return catalog.find((f) => f.key === key);
}

/** Distinct categories in catalog order — drives the grouped field menu. */
export function fieldCategories(catalog: FieldDef[]): string[] {
  const seen: string[] = [];
  for (const f of catalog) if (!seen.includes(f.category)) seen.push(f.category);
  return seen;
}
