'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Search, Loader2, Ban, RotateCcw, Trash2, ShieldCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fmtDate } from '../_lib/format';

export interface UserView {
  id: string;
  email: string | null;
  fullName: string | null;
  accountName: string | null;
  role: string | null;
  isOwner: boolean;
  /** In the ADMIN_EMAILS allowlist — protected from suspend/delete. */
  isAdmin: boolean;
  suspended: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
}

type Filter = 'all' | 'active' | 'suspended';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All users' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];

export function UsersTable({ rows }: { rows: UserView[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserView | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'active' && r.suspended) return false;
      if (filter === 'suspended' && !r.suspended) return false;
      if (!q) return true;
      return (
        (r.email ?? '').toLowerCase().includes(q) ||
        (r.fullName ?? '').toLowerCase().includes(q) ||
        (r.accountName ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

  async function setStatus(u: UserView, action: 'suspend' | 'reactivate') {
    setBusyId(u.id);
    try {
      const res = await fetch(`/admin/api/users/${u.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Update failed');
        return;
      }
      toast.success(action === 'suspend' ? 'User suspended' : 'User reactivated');
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    const u = deleteTarget;
    if (!u) return;
    setBusyId(u.id);
    try {
      const res = await fetch(`/admin/api/users/${u.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Delete failed');
        return;
      }
      toast.success('User deleted');
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email, name, or workspace"
            className="h-11 pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => v && setFilter(v as Filter)}>
          <SelectTrigger className="h-11 w-full border-border sm:w-48">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
              <TableHead className="text-muted-foreground">User</TableHead>
              <TableHead className="text-muted-foreground hidden md:table-cell">
                Workspace
              </TableHead>
              <TableHead className="text-muted-foreground hidden sm:table-cell">
                Role
              </TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground hidden lg:table-cell">
                Created
              </TableHead>
              <TableHead className="text-muted-foreground text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No users match.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => {
                const busy = busyId === u.id;
                return (
                  <TableRow key={u.id} className="border-border hover:bg-muted/50">
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {u.fullName || u.email || 'Unknown'}
                        </p>
                        {u.fullName && u.email && (
                          <p className="truncate text-xs text-muted-foreground">
                            {u.email}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {u.accountName ?? '—'}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground capitalize sm:table-cell">
                      {u.role ?? 'member'}
                      {u.isOwner && (
                        <span className="text-[11px] text-muted-foreground">
                          {' '}· owner
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge admin={u.isAdmin} suspended={u.suspended} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {u.createdAt ? fmtDate(u.createdAt) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {u.isAdmin ? (
                        <span className="text-xs text-muted-foreground">
                          Protected
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          {u.suspended ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => setStatus(u, 'reactivate')}
                              className="border-border"
                            >
                              {busy ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="size-3.5" />
                              )}
                              Reactivate
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => setStatus(u, 'suspend')}
                              className="border-border"
                            >
                              {busy ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Ban className="size-3.5" />
                              )}
                              Suspend
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => setDeleteTarget(u)}
                            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Delete user"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>
              This permanently deletes{' '}
              <span className="font-medium text-foreground">
                {deleteTarget?.email ?? deleteTarget?.fullName ?? 'this user'}
              </span>{' '}
              and their profile. This cannot be undone. If they own a workspace,
              you&apos;ll need to reassign ownership first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={busyId === deleteTarget?.id}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmDelete}
              disabled={busyId === deleteTarget?.id}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {busyId === deleteTarget?.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({
  admin,
  suspended,
}: {
  admin: boolean;
  suspended: boolean;
}) {
  if (admin) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
        <ShieldCheck className="size-3" />
        Admin
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        suspended
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      )}
    >
      {suspended ? 'Suspended' : 'Active'}
    </span>
  );
}
