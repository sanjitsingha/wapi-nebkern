'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Search,
  Loader2,
  Ban,
  RotateCcw,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  MailWarning,
} from 'lucide-react';

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
import { ExportCsvButton } from './export-csv';
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
  /** False for a signup that never entered the emailed code. */
  emailConfirmed: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
}

type Filter = 'all' | 'active' | 'suspended' | 'unconfirmed';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All users' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'unconfirmed', label: 'Unconfirmed email' },
];

/** What the API reports back when the user owns one or more workspaces. */
interface OwnedAccounts {
  /** Every workspace that gets destroyed alongside the user. */
  workspaces: string[];
  /** Distinct other people who lose their workspace with it. */
  otherMembers: number;
}

/** "a", "a and b", "a, b and c" — for reading out workspace names. */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'their workspace';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function UsersTable({ rows }: { rows: UserView[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserView | null>(null);
  // Set once the API has told us this user owns a workspace. Its
  // presence escalates the dialog to the second, louder confirmation —
  // the one that authorises taking the whole tenant down.
  const [ownedAccount, setOwnedAccount] = useState<OwnedAccounts | null>(null);

  const closeDelete = () => {
    setDeleteTarget(null);
    setOwnedAccount(null);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'active' && r.suspended) return false;
      if (filter === 'suspended' && !r.suspended) return false;
      if (filter === 'unconfirmed' && r.emailConfirmed) return false;
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
      toast.success(
        action === 'suspend' ? 'User suspended' : 'User reactivated'
      );
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  /**
   * `cascade` is the user's answer to the second confirmation. The first
   * call goes without it: if the user owns a workspace the API refuses
   * with 409 and describes what deleting it would take down, which is
   * what the escalated dialog then shows.
   */
  async function confirmDelete(cascade = false) {
    const u = deleteTarget;
    if (!u) return;
    setBusyId(u.id);
    try {
      const res = await fetch(`/admin/api/users/${u.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteOwnedAccount: cascade }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409 && data.requiresAccountDeletion) {
        setOwnedAccount({
          workspaces: data.workspaces?.length
            ? data.workspaces
            : ['their workspace'],
          otherMembers: data.otherMembers ?? 0,
        });
        return;
      }
      if (!res.ok) {
        toast.error(data.error ?? 'Delete failed');
        return;
      }

      toast.success('User deleted');
      closeDelete();
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email, name, or workspace"
            className="h-9 pl-9"
          />
        </div>
        <Select
          value={filter}
          onValueChange={(v) => v && setFilter(v as Filter)}
        >
          <SelectTrigger className="h-9 w-full border-(--admin-line) sm:w-48">
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
        <ExportCsvButton
          rows={filtered}
          filename="users"
          columns={[
            { header: 'Email', value: (r) => r.email },
            { header: 'Name', value: (r) => r.fullName },
            { header: 'Workspace', value: (r) => r.accountName },
            { header: 'Role', value: (r) => r.role },
            { header: 'Owner', value: (r) => (r.isOwner ? 'yes' : '') },
            { header: 'Suspended', value: (r) => (r.suspended ? 'yes' : '') },
            {
              header: 'Email confirmed',
              value: (r) => (r.emailConfirmed ? 'yes' : 'no'),
            },
            { header: 'Created', value: (r) => r.createdAt },
            { header: 'Last sign-in', value: (r) => r.lastSignInAt },
          ]}
        />
      </div>

      <div className="bg-card overflow-x-auto rounded-sm border border-(--admin-line)">
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
                  className="text-muted-foreground h-24 text-center text-sm"
                >
                  No users match.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => {
                const busy = busyId === u.id;
                return (
                  <TableRow
                    key={u.id}
                    className="border-border hover:bg-muted/50"
                  >
                    <TableCell>
                      <div className="min-w-0">
                        <p className="text-foreground truncate font-medium">
                          {u.fullName || u.email || 'Unknown'}
                        </p>
                        {u.fullName && u.email && (
                          <p className="text-muted-foreground truncate text-xs">
                            {u.email}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {u.accountName ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden capitalize sm:table-cell">
                      {u.role ?? 'member'}
                      {u.isOwner && (
                        <span className="text-muted-foreground text-[11px]">
                          {' '}
                          · owner
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        admin={u.isAdmin}
                        suspended={u.suspended}
                        emailConfirmed={u.emailConfirmed}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">
                      {u.createdAt ? fmtDate(u.createdAt) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {u.isAdmin ? (
                        <span className="text-muted-foreground text-xs">
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
        onOpenChange={(open) => !open && closeDelete()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {ownedAccount
                ? ownedAccount.workspaces.length > 1
                  ? 'Delete the workspaces too?'
                  : 'Delete the workspace too?'
                : 'Delete user?'}
            </DialogTitle>
            <DialogDescription>
              {ownedAccount ? (
                <>
                  <span className="text-foreground font-medium">
                    {deleteTarget?.email ??
                      deleteTarget?.fullName ??
                      'This user'}
                  </span>{' '}
                  owns{' '}
                  <span className="text-foreground font-medium">
                    {listNames(ownedAccount.workspaces)}
                  </span>
                  , so they can&apos;t be removed on their own. Deleting them
                  also permanently deletes{' '}
                  {ownedAccount.workspaces.length > 1
                    ? 'those workspaces'
                    : 'that workspace'}{' '}
                  and everything in{' '}
                  {ownedAccount.workspaces.length > 1 ? 'them' : 'it'} —
                  contacts, conversations, deals, invoices, templates and media.
                </>
              ) : (
                <>
                  This permanently deletes{' '}
                  <span className="text-foreground font-medium">
                    {deleteTarget?.email ??
                      deleteTarget?.fullName ??
                      'this user'}
                  </span>{' '}
                  and their profile. This cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* The case that actually hurts: other people's data goes with
              it. Only worth shouting about when there are others. */}
          {ownedAccount && ownedAccount.otherMembers > 0 && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive flex gap-2.5 rounded-lg border p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                {ownedAccount.otherMembers} other member
                {ownedAccount.otherMembers === 1 ? '' : 's'} will lose access.
                Their sign-in still works, but they&apos;ll have no workspace
                left to sign in to.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDelete}
              disabled={busyId === deleteTarget?.id}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => confirmDelete(ownedAccount != null)}
              disabled={busyId === deleteTarget?.id}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {busyId === deleteTarget?.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {ownedAccount
                ? ownedAccount.workspaces.length > 1
                  ? 'Delete user and workspaces'
                  : 'Delete user and workspace'
                : 'Delete user'}
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
  emailConfirmed,
}: {
  admin: boolean;
  suspended: boolean;
  emailConfirmed: boolean;
}) {
  if (admin) {
    return (
      <span className="border-primary/30 bg-primary-soft text-primary inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium">
        <ShieldCheck className="size-3" />
        Admin
      </span>
    );
  }
  // Ranked above active/suspended: an unconfirmed row is the one an
  // admin is usually hunting for, since it holds an address hostage
  // without ever having become a usable account.
  if (!emailConfirmed && !suspended) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
        <MailWarning className="size-3" />
        Unconfirmed
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        suspended
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      )}
    >
      {suspended ? 'Suspended' : 'Active'}
    </span>
  );
}
