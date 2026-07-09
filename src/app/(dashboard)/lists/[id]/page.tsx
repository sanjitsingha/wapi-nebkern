'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  Users,
  User,
  Phone,
  CalendarDays,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useCan } from '@/hooks/use-can';
import { GatedButton } from '@/components/ui/gated-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
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
import { EditListDialog } from '@/components/lists/edit-list-dialog';
import { DeleteListDialog } from '@/components/lists/delete-list-dialog';
import { DuplicateListDialog } from '@/components/lists/duplicate-list-dialog';
import { AddContactsDialog } from '@/components/lists/add-contacts-dialog';
import { listStatusConfig } from '@/lib/list-status';
import type { Contact, List } from '@/types';

const PAGE_SIZE = 25;

type SortOption = 'added_at_desc' | 'added_at_asc' | 'name_asc' | 'name_desc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'added_at_desc', label: 'Recently added' },
  { value: 'added_at_asc', label: 'Oldest added' },
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
];

interface ListContactRow {
  contact: Contact;
  added_at: string;
  total_count: number;
}

interface CreatedByProfile {
  full_name: string | null;
  email: string;
}

export default function ListDetailPage() {
  const params = useParams<{ id: string }>();
  const listId = params.id;
  const router = useRouter();
  const supabase = createClient();
  const canEditSettings = useCan('edit-settings');
  const canManageMembers = useCan('send-messages');

  const [list, setList] = useState<List | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [createdBy, setCreatedBy] = useState<CreatedByProfile | null>(null);

  const [rows, setRows] = useState<ListContactRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('added_at_desc');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [editOpen, setEditOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addContactsOpen, setAddContactsOpen] = useState(false);
  const [existingContactIds, setExistingContactIds] = useState<Set<string>>(
    new Set()
  );

  const fetchList = useCallback(async () => {
    setListLoading(true);
    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .eq('id', listId)
      .maybeSingle();

    if (error || !data) {
      toast.error('Failed to load list');
      setListLoading(false);
      return;
    }

    const row = data as List;
    setList(row);
    setListLoading(false);

    if (row.created_by) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', row.created_by)
        .maybeSingle();
      setCreatedBy((profile as CreatedByProfile) ?? null);
    } else {
      setCreatedBy(null);
    }
  }, [supabase, listId]);

  const fetchPage = useCallback(async () => {
    setRowsLoading(true);
    const { data, error } = await supabase.rpc('list_contacts_page', {
      p_list_id: listId,
      p_search: search.trim() || null,
      p_sort: sort,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
    });

    if (error) {
      toast.error('Failed to load contacts');
      setRowsLoading(false);
      return;
    }

    const result = (data as ListContactRow[]) ?? [];
    setRows(result);
    setTotalCount(result[0]?.total_count ?? 0);
    setRowsLoading(false);
  }, [supabase, listId, search, sort, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPage();
  }, [fetchPage]);

  useEffect(() => {
    if (!addContactsOpen) return;
    async function loadExisting() {
      const { data } = await supabase
        .from('contact_lists')
        .select('contact_id')
        .eq('list_id', listId);
      setExistingContactIds(new Set((data ?? []).map((r) => r.contact_id)));
    }
    loadExisting();
  }, [addContactsOpen, supabase, listId]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasPrev = page > 0;
  const hasNext = page < totalPages - 1;

  const allOnPageSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.contact.id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelected((prev) => {
      if (allOnPageSelected) {
        const next = new Set(prev);
        rows.forEach((r) => next.delete(r.contact.id));
        return next;
      }
      const next = new Set(prev);
      rows.forEach((r) => next.add(r.contact.id));
      return next;
    });
  }

  async function removeContacts(contactIds: string[]) {
    const { error } = await supabase
      .from('contact_lists')
      .delete()
      .eq('list_id', listId)
      .in('contact_id', contactIds);

    if (error) {
      toast.error('Failed to remove contact(s) from list');
      return;
    }

    toast.success(
      `${contactIds.length} contact${contactIds.length === 1 ? '' : 's'} removed`
    );
    setSelected((prev) => {
      const next = new Set(prev);
      contactIds.forEach((id) => next.delete(id));
      return next;
    });
    fetchPage();
    fetchList();
  }

  const status = list ? listStatusConfig[list.status] : null;

  const statTiles = useMemo(() => {
    if (!list) return [];
    return [
      { label: 'Total Contacts', value: String(list.total_contacts) },
      {
        label: 'Created By',
        value: createdBy?.full_name || createdBy?.email || '—',
      },
      {
        label: 'Created Date',
        value: new Date(list.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      },
      {
        label: 'Last Updated',
        value: new Date(list.updated_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      },
    ];
  }, [list, createdBy]);

  if (listLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <p className="text-sm text-muted-foreground">List not found.</p>
        <Button variant="outline" onClick={() => router.push('/lists')}>
          Back to lists
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {/* Back link + list name on one line, split by a dot. */}
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/lists')}
              className="-ml-2 h-8 shrink-0 px-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <span className="shrink-0 text-muted-foreground/40 select-none">
              •
            </span>
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: list.color || '#94a3b8' }}
            />
            <h1 className="truncate text-2xl font-bold text-foreground">
              {list.name}
            </h1>
            {status && (
              <Badge className={`shrink-0 border text-xs ${status.classes}`}>
                {status.label}
              </Badge>
            )}
          </div>
          {list.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {list.description}
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" className="shrink-0 border-border" />
            }
          >
            <MoreHorizontal className="size-4" />
            Actions
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-border bg-popover">
            <DropdownMenuItem
              disabled={!canEditSettings}
              onClick={() => setEditOpen(true)}
              className="text-popover-foreground focus:bg-muted focus:text-foreground"
            >
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canEditSettings}
              onClick={() => setDuplicateOpen(true)}
              className="text-popover-foreground focus:bg-muted focus:text-foreground"
            >
              <Copy className="size-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canEditSettings}
              onClick={async () => {
                const nextStatus = list.status === 'active' ? 'archived' : 'active';
                const { error } = await supabase
                  .from('lists')
                  .update({ status: nextStatus })
                  .eq('id', list.id);
                if (error) {
                  toast.error('Failed to update list');
                  return;
                }
                toast.success(
                  nextStatus === 'archived' ? 'List archived' : 'List restored'
                );
                setList({ ...list, status: nextStatus });
              }}
              className="text-popover-foreground focus:bg-muted focus:text-foreground"
            >
              <Users className="size-4" />
              {list.status === 'active' ? 'Archive' : 'Restore'}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              variant="destructive"
              disabled={!canEditSettings}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statTiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground">{tile.label}</p>
            <p className="mt-1 truncate text-lg font-semibold text-foreground">
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search contacts..."
              className="h-11 border-border bg-card pl-8 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <Select
            value={sort}
            onValueChange={(v) => {
              setSort(v as SortOption);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-11 w-auto gap-2 border-border bg-background">
              <ArrowUpDown className="size-4 text-muted-foreground" />
              Sort
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selected.size > 0 && (
            <div className="flex h-11 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3">
              <p className="text-sm text-foreground">
                <span className="font-medium">{selected.size}</span> selected
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
              <GatedButton
                variant="destructive"
                size="sm"
                canAct={canManageMembers}
                gateReason="remove contacts from lists"
                onClick={() => removeContacts(Array.from(selected))}
                className="h-8 px-2"
              >
                <Trash2 className="size-4" />
                Remove from list
              </GatedButton>
            </div>
          )}
        </div>

        <GatedButton
          canAct={canManageMembers}
          gateReason="add contacts to lists"
          onClick={() => setAddContactsOpen(true)}
          className="h-11 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <UserPlus className="size-4" />
          Add contacts
        </GatedButton>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-12 min-w-12 px-2">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={toggleSelectAllOnPage}
                  disabled={rows.length === 0}
                  aria-label="Select all contacts on this page"
                  className="ml-3 size-3.5"
                />
              </TableHead>
              <TableHead className="text-muted-foreground" icon={User}>Name</TableHead>
              <TableHead className="text-muted-foreground" icon={Phone}>Phone</TableHead>
              <TableHead className="hidden text-muted-foreground md:table-cell" icon={CalendarDays}>
                Added
              </TableHead>
              <TableHead className="w-12 text-muted-foreground" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowsLoading ? (
              <TableRow className="border-border">
                <TableCell colSpan={5} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      Loading contacts...
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={5} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {search
                        ? 'No contacts match your search.'
                        : 'No contacts in this list yet.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map(({ contact, added_at }) => (
                <TableRow
                  key={contact.id}
                  data-state={selected.has(contact.id) ? 'selected' : undefined}
                  className="cursor-pointer border-border hover:bg-muted/50"
                  onClick={() => router.push(`/contacts/${contact.id}`)}
                >
                  <TableCell
                    className="w-12 min-w-12 px-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selected.has(contact.id)}
                      onCheckedChange={() => toggleSelect(contact.id)}
                      aria-label={`Select ${contact.name || contact.phone}`}
                      className="ml-3 size-3.5"
                    />
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {contact.name || (
                      <span className="text-muted-foreground italic">
                        Unnamed
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {contact.phone}
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                    {new Date(added_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <GatedButton
                      canAct={canManageMembers}
                      gateReason="remove contacts from lists"
                      variant="ghost"
                      size="icon-sm"
                      title="Remove from list"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeContacts([contact.id])}
                    >
                      <Trash2 className="size-4" />
                    </GatedButton>
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
            Showing {page * PAGE_SIZE + 1}-
            {Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!hasPrev}
              onClick={() => setPage((p) => p - 1)}
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-2 text-xs text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <EditListDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        list={list}
        onSaved={(updated) => setList(updated)}
      />

      <DuplicateListDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        list={list}
        onDuplicated={(created) => router.push(`/lists/${created.id}`)}
      />

      <DeleteListDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        list={list}
        onDeleted={() => router.push('/lists')}
      />

      <AddContactsDialog
        open={addContactsOpen}
        onOpenChange={setAddContactsOpen}
        listId={listId}
        existingContactIds={existingContactIds}
        onAdded={() => {
          fetchPage();
          fetchList();
        }}
      />
    </div>
  );
}
