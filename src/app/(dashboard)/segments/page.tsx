'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Copy,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Archive,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useCan } from '@/hooks/use-can';
import { GatedButton } from '@/components/ui/gated-button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { CreateSegmentModal } from '@/components/segments/create-segment-modal';
import { listStatusConfig } from '@/lib/list-status';
import {
  loadSegments,
  duplicateSegment,
  deleteSegment,
  updateSegment,
} from '@/lib/segments/queries';
import { countRules } from '@/lib/segments/rules';
import type { Segment, SegmentStatus } from '@/types';

type StatusTab = 'all' | SegmentStatus;

export default function SegmentsPage() {
  const supabase = createClient();
  const router = useRouter();
  const canEditSettings = useCan('edit-settings');

  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const fetchSegments = useCallback(async () => {
    setLoading(true);
    try {
      setSegments(await loadSegments(supabase));
    } catch {
      toast.error('Failed to load segments');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  async function toggleArchived(segment: Segment) {
    const nextStatus: SegmentStatus =
      segment.status === 'active' ? 'archived' : 'active';
    try {
      await updateSegment(supabase, segment.id, { status: nextStatus });
      toast.success(nextStatus === 'archived' ? 'Segment archived' : 'Segment restored');
      setSegments((prev) =>
        prev.map((s) => (s.id === segment.id ? { ...s, status: nextStatus } : s)),
      );
    } catch {
      toast.error('Failed to update segment');
    }
  }

  async function handleDuplicate(segment: Segment) {
    try {
      const created = await duplicateSegment(supabase, segment, `${segment.name} (copy)`);
      toast.success('Segment duplicated');
      setSegments((prev) => [created, ...prev]);
    } catch {
      toast.error('Failed to duplicate segment');
    }
  }

  async function handleDelete(segment: Segment) {
    try {
      await deleteSegment(supabase, segment.id);
      toast.success('Segment deleted');
      setSegments((prev) => prev.filter((s) => s.id !== segment.id));
    } catch {
      toast.error('Failed to delete segment');
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return segments.filter((s) => {
      const matchesTab = activeTab === 'all' || s.status === activeTab;
      const matchesSearch =
        !term ||
        [s.name, s.description].filter(Boolean).join(' ').toLowerCase().includes(term);
      return matchesTab && matchesSearch;
    });
  }, [segments, search, activeTab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Segments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dynamic audiences that stay up to date automatically — built from filter rules, not a fixed contact list.
          </p>
        </div>
        <GatedButton
          canAct={canEditSettings}
          gateReason="create segments"
          className="h-11 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-2 size-4" />
          Create segment
        </GatedButton>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search segments..."
            className="h-11 border-border bg-card pl-8 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StatusTab)}>
          <TabsList variant="line" className="gap-3 rounded-lg bg-transparent p-1">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
              <TableHead className="text-muted-foreground">Name</TableHead>
              <TableHead className="text-muted-foreground">Description</TableHead>
              <TableHead className="text-muted-foreground">Rules</TableHead>
              <TableHead className="text-muted-foreground">Est. Contacts</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Created</TableHead>
              <TableHead className="w-12 text-muted-foreground" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={7} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading segments...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={7} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Filter className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {segments.length === 0
                        ? 'No segments yet.'
                        : 'No segments match your filters.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((segment) => {
                const status = listStatusConfig[segment.status];
                return (
                  <TableRow
                    key={segment.id}
                    className="cursor-pointer border-border hover:bg-muted/50"
                    onClick={() => router.push(`/segments/${segment.id}`)}
                  >
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: segment.color || '#94a3b8' }}
                        />
                        {segment.name}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {segment.description || <span>—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {countRules(segment.rules)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {segment.estimated_count ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={`border text-xs ${status.classes}`}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(segment.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              type="button"
                              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                              onClick={(e) => e.stopPropagation()}
                            />
                          }
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="border-border bg-popover">
                          <DropdownMenuItem
                            disabled={!canEditSettings}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicate(segment);
                            }}
                            className="text-popover-foreground focus:bg-muted focus:text-foreground"
                          >
                            <Copy className="size-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!canEditSettings}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleArchived(segment);
                            }}
                            className="text-popover-foreground focus:bg-muted focus:text-foreground"
                          >
                            <Archive className="size-4" />
                            {segment.status === 'active' ? 'Archive' : 'Restore'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-border" />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={!canEditSettings}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(segment);
                            }}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CreateSegmentModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
