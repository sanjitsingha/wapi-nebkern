'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  MoreHorizontal,
  Save,
  Search,
  Trash2,
  Users,
  Archive,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useCan } from '@/hooks/use-can';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { SegmentBuilder, type ListOption } from '@/components/segments/segment-builder';
import { listStatusConfig } from '@/lib/list-status';
import { buildFieldCatalog, type FieldDef } from '@/lib/segments/fields';
import { countRules, validateRules } from '@/lib/segments/rules';
import {
  loadSegment,
  updateSegment,
  duplicateSegment,
  deleteSegment,
  countSegment,
  segmentContactsPage,
} from '@/lib/segments/queries';
import type {
  Contact,
  CustomField,
  Segment,
  SegmentGroup,
  SegmentStatus,
  Tag,
} from '@/types';

const PAGE_SIZE = 25;

export default function SegmentDetailPage() {
  const params = useParams<{ id: string }>();
  const segmentId = params.id;
  const router = useRouter();
  const supabase = createClient();
  const { accountId } = useAuth();
  const canEdit = useCan('edit-settings');

  const [segment, setSegment] = useState<Segment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable working copy.
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState<SegmentGroup>({ combinator: 'and', rules: [] });

  // Builder resources.
  const [catalog, setCatalog] = useState<FieldDef[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [lists, setLists] = useState<ListOption[]>([]);

  // Live evaluation (debounced snapshot of `rules`).
  const [evalRules, setEvalRules] = useState<SegmentGroup | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  // Preview table.
  const [rows, setRows] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // ── Initial load: segment + builder resources ──────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [seg, cf, tg, ls] = await Promise.all([
          loadSegment(supabase, segmentId),
          supabase.from('custom_fields').select('*').order('field_name'),
          supabase.from('tags').select('*').order('name'),
          supabase.from('lists').select('id, name').eq('status', 'active').order('name'),
        ]);
        if (cancelled) return;
        if (!seg) {
          setSegment(null);
          setLoading(false);
          return;
        }
        setSegment(seg);
        setName(seg.name);
        setDescription(seg.description ?? '');
        setRules(seg.rules);
        setEvalRules(seg.rules);
        setCatalog(buildFieldCatalog((cf.data as CustomField[]) ?? []));
        setTags((tg.data as Tag[]) ?? []);
        setLists((ls.data as ListOption[]) ?? []);
      } catch {
        toast.error('Failed to load segment');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, segmentId]);

  // ── Debounce rule edits into `evalRules` ───────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setEvalRules(rules);
      setPage(0);
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [rules]);

  // ── Live count whenever the evaluated rules change ─────────────────
  useEffect(() => {
    if (!accountId || !evalRules) return;
    let cancelled = false;
    setCountLoading(true);
    countSegment(supabase, accountId, evalRules)
      .then((n) => !cancelled && setCount(n))
      .catch(() => !cancelled && setCount(null))
      .finally(() => !cancelled && setCountLoading(false));
    return () => {
      cancelled = true;
    };
  }, [supabase, accountId, evalRules]);

  // ── Preview page ───────────────────────────────────────────────────
  useEffect(() => {
    if (!accountId || !evalRules) return;
    let cancelled = false;
    setPreviewLoading(true);
    segmentContactsPage(supabase, accountId, evalRules, {
      search,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return;
        setRows(res.contacts);
        setTotal(res.total);
      })
      .catch(() => !cancelled && setRows([]))
      .finally(() => !cancelled && setPreviewLoading(false));
    return () => {
      cancelled = true;
    };
  }, [supabase, accountId, evalRules, search, page]);

  const ruleCount = useMemo(() => countRules(rules), [rules]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSave = useCallback(async () => {
    if (!segment) return;
    const error = validateRules(rules, catalog);
    if (error) {
      toast.error(error);
      return;
    }
    if (!name.trim()) {
      toast.error('Segment needs a name.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateSegment(supabase, segment.id, {
        name: name.trim(),
        description: description.trim() || null,
        rules,
      });
      // Cache the freshly-evaluated estimate for the list page.
      if (count !== null) {
        await supabase
          .from('segments')
          .update({ estimated_count: count, count_computed_at: new Date().toISOString() })
          .eq('id', segment.id);
      }
      setSegment(updated);
      toast.success('Segment saved');
    } catch {
      toast.error('Failed to save segment');
    } finally {
      setSaving(false);
    }
  }, [segment, rules, catalog, name, description, count, supabase]);

  async function handleArchiveToggle() {
    if (!segment) return;
    const next: SegmentStatus = segment.status === 'active' ? 'archived' : 'active';
    try {
      const updated = await updateSegment(supabase, segment.id, { status: next });
      setSegment(updated);
      toast.success(next === 'archived' ? 'Segment archived' : 'Segment restored');
    } catch {
      toast.error('Failed to update segment');
    }
  }

  async function handleDuplicate() {
    if (!segment) return;
    try {
      const created = await duplicateSegment(supabase, segment, `${segment.name} (copy)`);
      toast.success('Segment duplicated');
      router.push(`/segments/${created.id}`);
    } catch {
      toast.error('Failed to duplicate segment');
    }
  }

  async function handleDelete() {
    if (!segment) return;
    try {
      await deleteSegment(supabase, segment.id);
      toast.success('Segment deleted');
      router.push('/segments');
    } catch {
      toast.error('Failed to delete segment');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!segment) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <p className="text-sm text-muted-foreground">Segment not found.</p>
        <Button variant="outline" onClick={() => router.push('/segments')}>
          Back to segments
        </Button>
      </div>
    );
  }

  const status = listStatusConfig[segment.status];

  return (
    <div className="space-y-6 pb-24">
      {/* Header: Back • name */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/segments')}
              className="-ml-2 h-8 shrink-0 px-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <span className="shrink-0 text-muted-foreground/40 select-none">•</span>
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: segment.color || '#94a3b8' }}
            />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
              className="h-9 max-w-sm border-transparent bg-transparent px-1 text-2xl font-bold text-foreground focus-visible:border-border"
              maxLength={80}
            />
            <Badge className={`shrink-0 border text-xs ${status.classes}`}>
              {status.label}
            </Badge>
          </div>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEdit}
            placeholder="Add a description…"
            className="mt-1 h-8 max-w-lg border-transparent bg-transparent px-1 text-sm text-muted-foreground focus-visible:border-border"
            maxLength={280}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" className="shrink-0 border-border" />}
          >
            <MoreHorizontal className="size-4" />
            Actions
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-border bg-popover">
            <DropdownMenuItem disabled={!canEdit} onClick={handleDuplicate}>
              <Copy className="size-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canEdit} onClick={handleArchiveToggle}>
              <Archive className="size-4" />
              {segment.status === 'active' ? 'Archive' : 'Restore'}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem variant="destructive" disabled={!canEdit} onClick={handleDelete}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Builder */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Filter rules</h2>
          <span className="text-xs text-muted-foreground">
            {ruleCount} {ruleCount === 1 ? 'condition' : 'conditions'}
          </span>
        </div>
        <SegmentBuilder
          value={rules}
          onChange={setRules}
          catalog={catalog}
          tags={tags}
          lists={lists}
        />
      </div>

      {/* Preview */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-foreground">Matching contacts</h2>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search matches..."
              className="h-9 border-border bg-card pl-8"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground">Phone</TableHead>
                <TableHead className="hidden text-muted-foreground sm:table-cell">Email</TableHead>
                <TableHead className="hidden text-muted-foreground md:table-cell">City</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewLoading ? (
                <TableRow className="border-border">
                  <TableCell colSpan={4} className="py-12 text-center">
                    <Loader2 className="mx-auto size-5 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={4} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="size-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {ruleCount === 0
                          ? 'Add conditions above to see matching contacts.'
                          : 'No contacts match these rules.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer border-border hover:bg-muted/50"
                    onClick={() => router.push(`/contacts/${c.id}`)}
                  >
                    <TableCell className="font-medium text-foreground">
                      {c.name || <span className="text-muted-foreground italic">Unnamed</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {c.phone}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {c.email || '—'}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {c.city || '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="border-border text-muted-foreground disabled:opacity-30"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="px-2 text-xs text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="border-border text-muted-foreground disabled:opacity-30"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Sticky save bar with live count */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-sm">
            <Users className="size-4 text-primary" />
            {countLoading ? (
              <span className="text-muted-foreground">Counting…</span>
            ) : (
              <span className="text-foreground">
                <span className="font-semibold tabular-nums">
                  {(count ?? 0).toLocaleString()}
                </span>{' '}
                matching {count === 1 ? 'contact' : 'contacts'}
              </span>
            )}
          </div>
          <Button onClick={handleSave} disabled={!canEdit || saving}>
            <Save className="size-4" />
            {saving ? 'Saving…' : 'Save segment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
