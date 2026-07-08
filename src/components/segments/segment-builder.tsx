'use client';

import { Plus, Trash2, FolderPlus, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SegmentGroup, SegmentNode, SegmentRule, Tag } from '@/types';
import { isSegmentGroup } from '@/types';
import {
  fieldCategories,
  findField,
  type FieldDef,
} from '@/lib/segments/fields';
import { emptyRule, emptyRootGroup } from '@/lib/segments/rules';

export interface ListOption {
  id: string;
  name: string;
}

// A muted accent per field category — used for the little dot beside the
// field select so a long rule list stays scannable by "kind".
const CATEGORY_COLOR: Record<string, string> = {
  Contact: '#3b82f6',
  Marketing: '#10b981',
  Tags: '#f59e0b',
  Lists: '#8b5cf6',
  Activity: '#06b6d4',
  'Custom fields': '#ec4899',
};

interface SharedResources {
  catalog: FieldDef[];
  tags: Tag[];
  lists: ListOption[];
}

interface SegmentBuilderProps extends SharedResources {
  value: SegmentGroup;
  onChange: (group: SegmentGroup) => void;
}

/** Root of the visual rule builder. */
export function SegmentBuilder({ value, onChange, ...resources }: SegmentBuilderProps) {
  return (
    <RuleGroupEditor group={value} onChange={onChange} depth={0} {...resources} />
  );
}

// ─── Group ───────────────────────────────────────────────────────────

interface RuleGroupEditorProps extends SharedResources {
  group: SegmentGroup;
  onChange: (group: SegmentGroup) => void;
  onRemove?: () => void;
  depth: number;
}

function RuleGroupEditor({
  group,
  onChange,
  onRemove,
  depth,
  catalog,
  tags,
  lists,
}: RuleGroupEditorProps) {
  const isRoot = depth === 0;

  const setChild = (i: number, node: SegmentNode) =>
    onChange({ ...group, rules: group.rules.map((r, idx) => (idx === i ? node : r)) });
  const removeChild = (i: number) =>
    onChange({ ...group, rules: group.rules.filter((_, idx) => idx !== i) });
  const addRule = () => onChange({ ...group, rules: [...group.rules, emptyRule()] });
  const addGroup = () => onChange({ ...group, rules: [...group.rules, emptyRootGroup()] });
  const toggleCombinator = () =>
    onChange({ ...group, combinator: group.combinator === 'and' ? 'or' : 'and' });

  return (
    <div
      className={cn(
        'rounded-xl',
        isRoot
          ? 'border border-border bg-card p-3 sm:p-4'
          : 'border-l-2 border-primary/40 bg-muted/30 py-3 pr-3 pl-4',
      )}
    >
      {/* Nested groups get a small header with a "group" affordance +
          remove. The root's heading lives on the page above the builder. */}
      {!isRoot && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <Layers className="size-3.5" />
            Group
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            aria-label="Remove group"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}

      {group.rules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            No conditions yet. Add one to start matching contacts.
          </p>
        </div>
      ) : (
        <div>
          {group.rules.map((child, i) => (
            <div key={i}>
              {/* Clickable AND/OR connector — the group's combinator lives
                  here (only meaningful with 2+ rules), keeping the header
                  uncluttered. Clicking any connector flips the whole group. */}
              {i > 0 && (
                <div className="flex items-center gap-2 py-1.5">
                  <button
                    type="button"
                    onClick={toggleCombinator}
                    className="rounded-md border border-primary/30 bg-primary-soft px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary uppercase transition-colors hover:bg-primary/15"
                    title="Toggle AND / OR"
                  >
                    {group.combinator}
                  </button>
                  <span className="h-px flex-1 bg-border/70" />
                </div>
              )}
              {isSegmentGroup(child) ? (
                <RuleGroupEditor
                  group={child}
                  onChange={(g) => setChild(i, g)}
                  onRemove={() => removeChild(i)}
                  depth={depth + 1}
                  catalog={catalog}
                  tags={tags}
                  lists={lists}
                />
              ) : (
                <RuleRow
                  rule={child}
                  onChange={(r) => setChild(i, r)}
                  onRemove={() => removeChild(i)}
                  catalog={catalog}
                  tags={tags}
                  lists={lists}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRule}
          className="h-8 border-border text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3.5" />
          Add condition
        </Button>
        {depth < 2 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addGroup}
            className="h-8 text-muted-foreground hover:text-foreground"
          >
            <FolderPlus className="size-3.5" />
            Add group
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Rule row ────────────────────────────────────────────────────────

interface RuleRowProps extends SharedResources {
  rule: SegmentRule;
  onChange: (rule: SegmentRule) => void;
  onRemove: () => void;
}

function RuleRow({ rule, onChange, onRemove, catalog, tags, lists }: RuleRowProps) {
  const field = findField(catalog, rule.field);
  const operator = field?.operators.find((o) => o.id === rule.op);
  const dotColor = field ? CATEGORY_COLOR[field.category] ?? '#94a3b8' : '#94a3b8';

  function changeField(key: string) {
    const next = findField(catalog, key);
    onChange({ field: key, op: next?.operators[0]?.id ?? 'equals', value: '' });
  }
  const changeOp = (op: string) => onChange({ ...rule, op });
  const changeValue = (value: string) => onChange({ ...rule, value });

  return (
    <div className="group flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2 transition-colors hover:border-primary/30">
      {/* Category dot */}
      <span
        className="ml-1 size-2 shrink-0 rounded-full"
        style={{ backgroundColor: dotColor }}
        aria-hidden
      />

      {/* Field */}
      <Select value={rule.field} onValueChange={(v) => v && changeField(v)}>
        <SelectTrigger className="h-9 w-40 border-border">
          <SelectValue placeholder="Field" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {fieldCategories(catalog).map((cat) => (
            <SelectGroup key={cat}>
              <SelectLabel>{cat}</SelectLabel>
              {catalog
                .filter((f) => f.category === cat)
                .map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.label}
                  </SelectItem>
                ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {/* Operator */}
      {field && (
        <Select value={rule.op} onValueChange={(v) => v && changeOp(v)}>
          <SelectTrigger className="h-9 w-40 border-border">
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            {field.operators.map((op) => (
              <SelectItem key={op.id} value={op.id}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Value */}
      {field && operator?.needsValue && (
        <ValueInput
          field={field}
          value={rule.value ?? ''}
          onChange={changeValue}
          tags={tags}
          lists={lists}
        />
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove condition"
        className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-60 transition-all hover:bg-muted hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function ValueInput({
  field,
  value,
  onChange,
  tags,
  lists,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
  tags: Tag[];
  lists: ListOption[];
}) {
  if (field.valueKind === 'tag') {
    return (
      <Select value={value} onValueChange={(v) => onChange(v ?? '')}>
        <SelectTrigger className="h-9 min-w-40 border-border">
          <SelectValue placeholder="Select tag" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {tags.length === 0 ? (
            <SelectItem value="__none" disabled>
              No tags
            </SelectItem>
          ) : (
            tags.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  {t.name}
                </span>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    );
  }

  if (field.valueKind === 'list') {
    return (
      <Select value={value} onValueChange={(v) => onChange(v ?? '')}>
        <SelectTrigger className="h-9 min-w-40 border-border">
          <SelectValue placeholder="Select list" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {lists.length === 0 ? (
            <SelectItem value="__none" disabled>
              No lists
            </SelectItem>
          ) : (
            lists.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    );
  }

  if (field.valueKind === 'date') {
    return (
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-44 border-border"
      />
    );
  }

  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Value"
      className="h-9 w-48 border-border"
    />
  );
}
