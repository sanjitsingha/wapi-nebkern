'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { CustomField, Tag, SegmentGroup } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  Tags,
  Filter,
  Target,
  Upload,
  Loader2,
  ArrowRight,
  ArrowLeft,
  X,
  ListChecks,
  ChevronDown,
} from 'lucide-react';

type AudienceType = 'all' | 'tags' | 'custom_field' | 'segment' | 'csv' | 'list';

interface SegmentOption {
  id: string;
  name: string;
  rules: SegmentGroup;
}

interface ListOption {
  id: string;
  name: string;
  total_contacts: number;
}
type CustomFieldOperator = 'is' | 'is_not' | 'contains';

interface CustomFieldFilter {
  fieldId: string;
  operator: CustomFieldOperator;
  value: string;
}

interface AudienceConfig {
  type: AudienceType;
  tagIds?: string[];
  customField?: CustomFieldFilter;
  segmentId?: string;
  listId?: string;
  csvContacts?: { phone: string; name?: string }[];
  excludeTagIds?: string[];
}

interface Step2Props {
  audience: AudienceConfig;
  onUpdate: (audience: AudienceConfig) => void;
  onNext?: () => void;
  onBack?: () => void;
  embedded?: boolean;
}

const audienceOptions: {
  type: AudienceType;
  label: string;
  description: string;
  icon: typeof Users;
}[] = [
  {
    type: 'all',
    label: 'All Contacts',
    description: 'Send to every contact in your database',
    icon: Users,
  },
  {
    type: 'tags',
    label: 'Filter by Tags',
    description: 'Target contacts with specific tags',
    icon: Tags,
  },
  {
    type: 'custom_field',
    label: 'Custom Field',
    description: 'Filter by a custom field value',
    icon: Filter,
  },
  {
    type: 'segment',
    label: 'Segment',
    description: 'Target a saved dynamic segment',
    icon: Target,
  },
  {
    type: 'list',
    label: 'List',
    description: 'Send to a saved contact list',
    icon: ListChecks,
  },
  {
    type: 'csv',
    label: 'Upload CSV',
    description: 'Upload a list of phone numbers',
    icon: Upload,
  },
];

const OPERATOR_OPTIONS: { value: CustomFieldOperator; label: string }[] = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'contains', label: 'contains' },
];

export function Step2SelectAudience({
  audience,
  onUpdate,
  onNext,
  onBack,
  embedded = false,
}: Step2Props) {
  const { accountId } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [lists, setLists] = useState<ListOption[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  // Tags are used both by the primary "Filter by Tags" audience type
  // AND by the exclude-list below — so always load once on mount.
  useEffect(() => {
    async function fetchTags() {
      setLoadingTags(true);
      try {
        const supabase = createClient();
        const { data } = await supabase.from('tags').select('*').order('name');
        setTags(data ?? []);
      } finally {
        setLoadingTags(false);
      }
    }
    fetchTags();
  }, []);

  // Lazy-load active segments only when that audience type is active.
  useEffect(() => {
    if (audience.type !== 'segment') return;
    async function fetchSegments() {
      const supabase = createClient();
      const { data } = await supabase
        .from('segments')
        .select('id, name, rules')
        .eq('status', 'active')
        .order('name');
      setSegments((data as SegmentOption[]) ?? []);
    }
    fetchSegments();
  }, [audience.type]);

  // Lazy-load active lists only when that audience type is active.
  useEffect(() => {
    if (audience.type !== 'list') return;
    async function fetchLists() {
      const supabase = createClient();
      const { data } = await supabase
        .from('lists')
        .select('id, name, total_contacts')
        .eq('status', 'active')
        .order('name');
      setLists((data as ListOption[]) ?? []);
    }
    fetchLists();
  }, [audience.type]);

  // Lazy-load custom fields only when that audience type is active.
  useEffect(() => {
    if (audience.type !== 'custom_field') return;
    async function fetchFields() {
      setLoadingFields(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('custom_fields')
          .select('*')
          .order('field_name');
        setCustomFields(data ?? []);
      } finally {
        setLoadingFields(false);
      }
    }
    fetchFields();
  }, [audience.type]);

  const fetchEstimatedCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const supabase = createClient();

      // Base query — produces the superset before exclude is applied.
      let baseIds: Set<string> | null = null; // null means "all contacts"

      if (audience.type === 'segment') {
        // Dynamic segment: evaluate its rules via the RPC.
        const seg = segments.find((s) => s.id === audience.segmentId);
        if (!seg || !accountId) {
          setEstimatedCount(null);
          return;
        }
        const { data: countData } = await supabase.rpc('segment_count', {
          p_account_id: accountId,
          p_rules: seg.rules,
        });
        setEstimatedCount(Number(countData ?? 0));
        return;
      } else if (audience.type === 'all') {
        // Handled below — full-table count adjusted by excludes.
      } else if (
        audience.type === 'tags' &&
        audience.tagIds &&
        audience.tagIds.length > 0
      ) {
        const { data } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', audience.tagIds);
        baseIds = new Set((data ?? []).map((r) => r.contact_id));
      } else if (audience.type === 'list' && audience.listId) {
        const { data } = await supabase
          .from('contact_lists')
          .select('contact_id')
          .eq('list_id', audience.listId);
        baseIds = new Set((data ?? []).map((r) => r.contact_id));
      } else if (
        audience.type === 'custom_field' &&
        audience.customField?.fieldId &&
        audience.customField.value
      ) {
        const { fieldId, operator, value } = audience.customField;
        let q = supabase
          .from('contact_custom_values')
          .select('contact_id')
          .eq('custom_field_id', fieldId);
        if (operator === 'is') q = q.eq('value', value);
        else if (operator === 'is_not') q = q.neq('value', value);
        else q = q.ilike('value', `%${value}%`);
        const { data } = await q;
        baseIds = new Set((data ?? []).map((r) => r.contact_id));
      } else if (
        audience.type === 'csv' &&
        audience.csvContacts &&
        audience.csvContacts.length > 0
      ) {
        setEstimatedCount(audience.csvContacts.length);
        return;
      } else {
        // Partially-configured audience — wait for the user to finish.
        setEstimatedCount(null);
        return;
      }

      // Apply exclude tags
      let excludeSet: Set<string> | null = null;
      if (audience.excludeTagIds && audience.excludeTagIds.length > 0) {
        const { data: excludeRows } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', audience.excludeTagIds);
        excludeSet = new Set((excludeRows ?? []).map((r) => r.contact_id));
      }

      if (baseIds) {
        const effective = [...baseIds].filter(
          (id) => !excludeSet?.has(id),
        );
        setEstimatedCount(effective.length);
      } else {
        // "All" — fetch the total, then subtract exclude set if any.
        const { count } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true });
        const total = count ?? 0;
        setEstimatedCount(excludeSet ? Math.max(0, total - excludeSet.size) : total);
      }
    } finally {
      setLoadingCount(false);
    }
  }, [
    audience.type,
    audience.tagIds,
    audience.customField,
    audience.segmentId,
    audience.listId,
    audience.csvContacts,
    audience.excludeTagIds,
    segments,
    accountId,
  ]);

  useEffect(() => {
    fetchEstimatedCount();
  }, [fetchEstimatedCount]);

  function toggleTag(tagId: string) {
    const current = audience.tagIds ?? [];
    const updated = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    onUpdate({ ...audience, tagIds: updated });
  }

  function toggleExcludeTag(tagId: string) {
    const current = audience.excludeTagIds ?? [];
    const updated = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    onUpdate({ ...audience, excludeTagIds: updated });
  }

  function updateCustomField(patch: Partial<CustomFieldFilter>) {
    const prev = audience.customField ?? {
      fieldId: '',
      operator: 'is' as CustomFieldOperator,
      value: '',
    };
    onUpdate({ ...audience, customField: { ...prev, ...patch } });
  }

  const isValid =
    audience.type === 'all' ||
    (audience.type === 'tags' && audience.tagIds && audience.tagIds.length > 0) ||
    (audience.type === 'custom_field' &&
      !!audience.customField?.fieldId &&
      audience.customField.value.length > 0) ||
    (audience.type === 'segment' && !!audience.segmentId) ||
    (audience.type === 'list' && !!audience.listId) ||
    (audience.type === 'csv' &&
      audience.csvContacts &&
      audience.csvContacts.length > 0);

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h2 className="text-lg font-semibold text-foreground">Select Audience</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose who will receive this broadcast.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Audience type</label>
        <Select
          value={audience.type}
          onValueChange={(value) => {
            const type = (value ?? 'all') as AudienceType;
            onUpdate({
              ...audience,
              type,
              // Wipe shape fields from other types to avoid stale
              // config leaking across selections.
              tagIds: type === 'tags' ? audience.tagIds : undefined,
              customField: type === 'custom_field' ? audience.customField : undefined,
              segmentId: type === 'segment' ? audience.segmentId : undefined,
              listId: type === 'list' ? audience.listId : undefined,
              csvContacts: type === 'csv' ? audience.csvContacts : undefined,
            });
          }}
        >
          <SelectTrigger className="w-full data-[size=default]:h-11">
            <SelectValue>
              {() => {
                const opt = audienceOptions.find((o) => o.type === audience.type);
                if (!opt) return null;
                const Icon = opt.icon;
                return (
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {opt.label}
                  </span>
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {audienceOptions.map((option) => {
              const Icon = option.icon;
              return (
                <SelectItem key={option.type} value={option.type}>
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {option.label}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {audienceOptions.find((o) => o.type === audience.type)?.description}
        </p>
      </div>

      {audience.type === 'tags' && (
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Select Tags</p>
          {loadingTags ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : tags.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No tags found. Create tags in Settings.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isSelected = audience.tagIds?.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-muted text-muted-foreground hover:border-border'
                    }`}
                  >
                    <span
                      className="mr-1.5 h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {audience.type === 'custom_field' && (
        <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4">
          <p className="text-sm font-medium text-foreground">Custom Field Filter</p>
          {loadingFields ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : customFields.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No custom fields defined. Create one in Settings → Custom Fields.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)]">
              <Select
                items={customFields.map((f) => ({ value: f.id, label: f.field_name }))}
                value={audience.customField?.fieldId || null}
                onValueChange={(v) => updateCustomField({ fieldId: v ?? '' })}
              >
                <SelectTrigger className="bg-muted w-full data-[size=default]:h-9">
                  <SelectValue placeholder="Select field…" />
                </SelectTrigger>
                <SelectContent>
                  {customFields.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.field_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                items={OPERATOR_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={audience.customField?.operator ?? 'is'}
                onValueChange={(v) =>
                  updateCustomField({
                    operator: (v ?? 'is') as CustomFieldOperator,
                  })
                }
              >
                <SelectTrigger className="bg-muted w-full data-[size=default]:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATOR_OPTIONS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="text"
                value={audience.customField?.value ?? ''}
                onChange={(e) => updateCustomField({ value: e.target.value })}
                placeholder="Value"
                className="h-9 rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>
      )}

      {audience.type === 'segment' && (
        <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4">
          <p className="text-sm font-medium text-foreground">Select Segment</p>
          {segments.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No active segments. Create one under Contacts → Segments.
            </p>
          ) : (
            <Select
              items={segments.map((s) => ({ value: s.id, label: s.name }))}
              value={audience.segmentId || null}
              onValueChange={(v) => onUpdate({ ...audience, segmentId: v ?? '' })}
            >
              <SelectTrigger className="bg-muted w-full data-[size=default]:h-9">
                <SelectValue placeholder="Select segment…" />
              </SelectTrigger>
              <SelectContent>
                {segments.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-muted-foreground">
            Recipients are re-evaluated from the segment&apos;s rules at send time.
          </p>
        </div>
      )}

      {audience.type === 'list' && (
        <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4">
          <p className="text-sm font-medium text-foreground">Select List</p>
          {lists.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No active lists. Create one under Contacts → Lists.
            </p>
          ) : (
            <Select
              items={lists.map((l) => ({
                value: l.id,
                label: `${l.name} (${l.total_contacts})`,
              }))}
              value={audience.listId || null}
              onValueChange={(v) => onUpdate({ ...audience, listId: v ?? '' })}
            >
              <SelectTrigger className="bg-muted w-full data-[size=default]:h-9">
                <SelectValue placeholder="Select list…" />
              </SelectTrigger>
              <SelectContent>
                {lists.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name} ({l.total_contacts})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-muted-foreground">
            The list&apos;s current members are used at send time.
          </p>
        </div>
      )}

      {/* Exclude list — applies regardless of audience type */}
      <div className="rounded-xl border border-border bg-card/50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <X className="h-4 w-4 text-red-400" />
          <p className="text-sm font-medium text-foreground">
            Exclude contacts with these tags
          </p>
          <span className="text-xs text-muted-foreground">(optional)</span>
        </div>
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tags available.</p>
        ) : (
          <div className="space-y-2.5">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    className="h-10 w-full justify-between gap-2 border-border sm:w-64"
                  />
                }
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Tags className="h-4 w-4" />
                  {(audience.excludeTagIds?.length ?? 0) > 0
                    ? `${audience.excludeTagIds?.length} tag${audience.excludeTagIds?.length === 1 ? '' : 's'} excluded`
                    : 'Select tags to exclude'}
                </span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
                {tags.map((tag) => (
                  <DropdownMenuCheckboxItem
                    key={tag.id}
                    checked={audience.excludeTagIds?.includes(tag.id) ?? false}
                    onCheckedChange={() => toggleExcludeTag(tag.id)}
                    className="gap-2"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Selected exclusions, as removable chips. */}
            {(audience.excludeTagIds?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags
                  .filter((tag) => audience.excludeTagIds?.includes(tag.id))
                  .map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleExcludeTag(tag.id)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/15 dark:text-red-300"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                      <X className="h-3 w-3" />
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Audience Summary */}
      <div className="rounded-xl border border-border bg-card/50 p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Audience Summary</p>
        {loadingCount ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Calculating…</span>
          </div>
        ) : estimatedCount !== null ? (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm text-foreground">
              {estimatedCount.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">estimated recipients</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Select an audience type to see the estimate.
          </p>
        )}
      </div>

      {!embedded && onBack && onNext && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button
            variant="outline"
            onClick={onBack}
            className="border-border text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={onNext}
            disabled={!isValid}
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
