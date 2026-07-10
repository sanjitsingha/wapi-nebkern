'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Copy,
  List as ListIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  AlignLeft,
  Users,
  CircleDot,
  CalendarDays,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useCan } from '@/hooks/use-can';
import { GatedButton } from '@/components/ui/gated-button';
import { Button } from '@/components/ui/button';
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
import { CreateListModal } from '@/components/lists/create-list-modal';
import { EditListDialog } from '@/components/lists/edit-list-dialog';
import { DeleteListDialog } from '@/components/lists/delete-list-dialog';
import { DuplicateListDialog } from '@/components/lists/duplicate-list-dialog';
import { listStatusConfig } from '@/lib/list-status';
import type { List, ListStatus } from '@/types';

type StatusTab = 'all' | ListStatus;

export default function ListsPage() {
  const supabase = createClient();
  const router = useRouter();
  const canEditSettings = useCan('edit-settings');

  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<List | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<List | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<List | null>(null);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load lists');
    } else {
      setLists((data as List[]) ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLists();
  }, [fetchLists]);

  async function toggleArchived(list: List) {
    const nextStatus: ListStatus =
      list.status === 'active' ? 'archived' : 'active';

    const { error } = await supabase
      .from('lists')
      .update({ status: nextStatus })
      .eq('id', list.id);

    if (error) {
      toast.error('Failed to update list');
      return;
    }

    toast.success(nextStatus === 'archived' ? 'List archived' : 'List restored');
    setLists((prev) =>
      prev.map((l) => (l.id === list.id ? { ...l, status: nextStatus } : l))
    );
  }

  const filteredLists = useMemo(() => {
    const term = search.trim().toLowerCase();
    return lists
      .filter((list) => {
        const matchesTab = activeTab === 'all' || list.status === activeTab;
        const matchesSearch =
          !term ||
          [list.name, list.description].filter(Boolean).join(' ').toLowerCase().includes(term);
        return matchesTab && matchesSearch;
      })
      .sort((a, b) => {
        const diff =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return sortDir === 'asc' ? diff : -diff;
      });
  }, [lists, search, activeTab, sortDir]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lists</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize contacts into collections for campaign audiences.
          </p>
        </div>
        <GatedButton
          canAct={canEditSettings}
          gateReason="create lists"
          className="h-11 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-2 size-4" />
          Create list
        </GatedButton>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lists..."
            className="h-11 border-border bg-card pl-8 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as StatusTab)}
        >
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
              <TableHead className="text-muted-foreground" icon={ListIcon}>Name</TableHead>
              <TableHead className="text-muted-foreground" icon={AlignLeft}>Description</TableHead>
              <TableHead className="text-muted-foreground" icon={Users}>Contacts</TableHead>
              <TableHead className="text-muted-foreground" icon={CircleDot}>Status</TableHead>
              <TableHead className="text-muted-foreground">
                <button
                  type="button"
                  onClick={() =>
                    setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
                  }
                  className="flex items-center gap-1.5 font-medium transition-colors hover:text-foreground"
                  title={`Sort by created date (${sortDir === 'desc' ? 'newest first' : 'oldest first'})`}
                >
                  <CalendarDays className="size-3.5 shrink-0" />
                  Created
                  {sortDir === 'desc' ? (
                    <ArrowDown className="size-3.5 shrink-0" />
                  ) : (
                    <ArrowUp className="size-3.5 shrink-0" />
                  )}
                </button>
              </TableHead>
              <TableHead className="w-12 text-muted-foreground" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={6} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading lists...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredLists.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={6} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <ListIcon className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {lists.length === 0 ? 'No lists yet.' : 'No lists match your filters.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredLists.map((list) => {
                const status = listStatusConfig[list.status];
                return (
                  <TableRow
                    key={list.id}
                    className="cursor-pointer border-border hover:bg-muted/50"
                    onClick={() => router.push(`/lists/${list.id}`)}
                  >
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: list.color || '#94a3b8' }}
                        />
                        {list.name}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {list.description || <span>—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {list.total_contacts}
                    </TableCell>
                    <TableCell>
                      <Badge className={`border text-xs ${status.classes}`}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(list.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-foreground"
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
                              setEditTarget(list);
                            }}
                            className="text-popover-foreground focus:bg-muted focus:text-foreground"
                          >
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!canEditSettings}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDuplicateTarget(list);
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
                              toggleArchived(list);
                            }}
                            className="text-popover-foreground focus:bg-muted focus:text-foreground"
                          >
                            <ListIcon className="size-4" />
                            {list.status === 'active' ? 'Archive' : 'Restore'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-border" />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={!canEditSettings}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(list);
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

      <CreateListModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(list) => setLists((prev) => [list, ...prev])}
      />

      <EditListDialog
        open={editTarget !== null}
        onOpenChange={(open) => !open && setEditTarget(null)}
        list={editTarget}
        onSaved={(updated) => {
          setLists((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
        }}
      />

      <DuplicateListDialog
        open={duplicateTarget !== null}
        onOpenChange={(open) => !open && setDuplicateTarget(null)}
        list={duplicateTarget}
        onDuplicated={(created) => setLists((prev) => [created, ...prev])}
      />

      <DeleteListDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        list={deleteTarget}
        onDeleted={(listId) => setLists((prev) => prev.filter((l) => l.id !== listId))}
      />
    </div>
  );
}
