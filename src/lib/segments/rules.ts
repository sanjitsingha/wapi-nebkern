// Pure helpers for working with the Segment rule tree — construction,
// counting, and validation. Kept UI-free so both the builder and the
// save path share one definition of "valid".

import type { SegmentGroup, SegmentNode, SegmentRule } from '@/types';
import { isSegmentGroup } from '@/types';
import { STATIC_FIELDS, findField, type FieldDef } from './fields';

export function emptyRootGroup(): SegmentGroup {
  return { combinator: 'and', rules: [] };
}

/** A fresh leaf, defaulting to the first catalog field's first operator. */
export function emptyRule(): SegmentRule {
  const first = STATIC_FIELDS[0];
  return { field: first.key, op: first.operators[0].id, value: '' };
}

/** Total number of leaf conditions anywhere in the tree ("Rule Count"). */
export function countRules(node: SegmentNode): number {
  if (!isSegmentGroup(node)) return 1;
  return node.rules.reduce((sum, child) => sum + countRules(child), 0);
}

export function hasAnyRule(group: SegmentGroup): boolean {
  return countRules(group) > 0;
}

/** A leaf is complete when a value is present for value-requiring ops. */
export function isRuleComplete(rule: SegmentRule, catalog: FieldDef[]): boolean {
  const field = findField(catalog, rule.field);
  if (!field) return false;
  const op = field.operators.find((o) => o.id === rule.op);
  if (!op) return false;
  if (!op.needsValue) return true;
  return rule.value !== undefined && rule.value !== '';
}

/**
 * Validate the whole tree for saving. Returns an error string to show the
 * user, or null when the segment is safe to persist / evaluate.
 */
export function validateRules(
  group: SegmentGroup,
  catalog: FieldDef[],
): string | null {
  if (!hasAnyRule(group)) return 'Add at least one condition.';
  const allComplete = everyLeaf(group, (r) => isRuleComplete(r, catalog));
  if (!allComplete) return 'Some conditions are missing a value.';
  return null;
}

function everyLeaf(
  node: SegmentNode,
  pred: (rule: SegmentRule) => boolean,
): boolean {
  if (!isSegmentGroup(node)) return pred(node);
  return node.rules.every((child) => everyLeaf(child, pred));
}
