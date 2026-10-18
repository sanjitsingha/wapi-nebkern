'use client';

// ============================================================
// MembersTab — Settings → Members
//
// Two stacked sections:
//   1. Roster   — every member of the account. Admin+ can change a
//                 teammate's role inline and remove them. Owner row
//                 is non-editable everywhere (transfer is its own
//                 separate flow, deferred to a later PR).
//   2. Pending  — outstanding invite links. Admin+ can revoke. The
//                 plaintext URL is gone after the create dialog
//                 closes, so we surface a "revoke + new link" hint
//                 rather than pretending we can resurface it.
//
// Role-gating
//   The tab itself is reachable by any member, but mutation buttons
//   are wrapped in `<RequireRole min="admin">` / `useCan` so an
//   agent or viewer sees the roster read-only. The server-side
//   RPCs (set_member_role, remove_account_member) double-check
//   the role anyway.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Camera,
  Loader2,
  Mail,
  MailX,
  Check,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { MdOutlineOpenInNew } from 'react-icons/md';

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { docHref } from '@/lib/docs/nav';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RequireRole } from '@/components/auth/require-role';
import { useAuth } from '@/hooks/use-auth';
import { usePresence } from '@/hooks/use-presence';
import { hasMinRole, type AccountRole } from '@/lib/auth/roles';
import { presenceLabel } from '@/lib/presence';
import { PRESENCE_DOT_CLASS } from '@/components/presence/presence-dot';
import { uploadAccountMedia } from '@/lib/storage/upload-media';
import { InviteMemberDialog } from './invite-member-dialog';
import { SettingsPanelHead } from './settings-panel-head';
import { ROLE_META, ROLE_PERMISSIONS } from './role-meta';

/** Same bucket the profile page uploads own avatars to. */
const AVATAR_BUCKET = 'avatars';

interface Member {
  user_id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  role: AccountRole;
  joined_at: string;
}

interface Invitation {
  id: string;
  role: 'admin' | 'agent' | 'viewer';
  label: string | null;
  created_at: string;
  expires_at: string;
}

// Editable roles in the inline dropdown. Owner is never an option —
// promotions go through the (deferred) Transfer Ownership flow.
const EDITABLE_ROLES: { value: AccountRole; label: string; hint: string }[] = [
  { value: 'admin', label: 'Admin', hint: 'Manage members + everything' },
  { value: 'agent', label: 'Agent', hint: 'Use features; no settings' },
  { value: 'viewer', label: 'Viewer', hint: 'Read-only across the app' },
];

// Per-role chip metadata (icon / label / colour) lives in the shared
// ROLE_META module so this roster and the Overview identity chip can't
// drift. The colour scale runs amber (owner — scarce, immutable) →
// primary (admin) → muted (agent / viewer).

function fmtExpiresIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return `expires in ${days} day${days === 1 ? '' : 's'}`;
  const hours = Math.max(1, Math.floor(ms / (60 * 60 * 1000)));
  return `expires in ${hours} hour${hours === 1 ? '' : 's'}`;
}

export function MembersTab() {
  const { user, canManageMembers } = useAuth();
  const { getPresence, getRow, now } = usePresence();

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [search, setSearch] = useState('');
  // Ticked teammates, removed together from the Delete beside Add member.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkRemoving, setBulkRemoving] = useState(false);
  // Name, email or role — whatever the search box holds.
  const visibleMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.full_name, m.email ?? '', ROLE_META[m.role]?.label ?? m.role].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [members, search]);
  // Pending invites sit in the same list, so the search covers them too.
  const visibleInvites = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invitations;
    return invitations.filter((inv) =>
      [inv.label ?? '', 'pending', ROLE_META[inv.role]?.label ?? inv.role].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [invitations, search]);
  const [removingMember, setRemovingMember] = useState<Member | null>(null);
  // The teammate whose role and access the pencil opened.
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [pendingMemberAction, setPendingMemberAction] = useState<string | null>(
    null,
  );

  // Profile-picture upload. One hidden <input> shared by every row; the
  // camera overlay on a row records which member it is for, then opens it.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const pickAvatar = (memberUserId: string) => {
    uploadTargetRef.current = memberUserId;
    fileInputRef.current?.click();
  };

  const onAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    // Reset immediately so re-picking the same file fires onChange again.
    e.target.value = '';
    const memberUserId = uploadTargetRef.current;
    uploadTargetRef.current = null;
    if (!file || !memberUserId) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      return;
    }

    setUploadingId(memberUserId);
    try {
      // Upload to the account's media store (R2/Supabase), same path
      // convention as the profile page, then point the member's profile at
      // it via the admin endpoint (RLS can't update another user's row).
      const { publicUrl } = await uploadAccountMedia(AVATAR_BUCKET, file);
      const res = await fetch(`/api/account/members/${memberUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: publicUrl }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || 'Failed to update photo');
        return;
      }
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === memberUserId ? { ...m, avatar_url: publicUrl } : m,
        ),
      );
      toast.success('Photo updated');
    } catch (err) {
      console.error('[MembersTab] avatar upload error:', err);
      toast.error('Upload failed — please try again');
    } finally {
      setUploadingId(null);
    }
  };

  const loadEverything = useCallback(async () => {
    try {
      const [mres, ires] = await Promise.all([
        fetch('/api/account/members', { cache: 'no-store' }),
        canManageMembers
          ? fetch('/api/account/invitations', { cache: 'no-store' })
          : Promise.resolve(null),
      ]);

      if (!mres.ok) {
        const payload = await mres.json().catch(() => ({}));
        toast.error(payload.error || 'Failed to load members');
        return;
      }
      const mdata = (await mres.json()) as { members: Member[] };
      setMembers(mdata.members);

      if (ires) {
        if (!ires.ok) {
          const payload = await ires.json().catch(() => ({}));
          toast.error(payload.error || 'Failed to load invitations');
          return;
        }
        const idata = (await ires.json()) as { invitations: Invitation[] };
        setInvitations(idata.invitations);
      } else {
        setInvitations([]);
      }
    } catch (err) {
      console.error('[MembersTab] load error:', err);
      toast.error('Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, [canManageMembers]);

  useEffect(() => {
    void loadEverything();
  }, [loadEverything]);

  async function handleRoleChange(member: Member, nextRole: AccountRole) {
    if (member.role === nextRole) return;
    // Optimistic update — flip the dropdown immediately so the UI
    // feels snappy. If the server PATCH fails we revert below so
    // the dropdown doesn't lie about the persisted state.
    const previousRole = member.role;
    setPendingMemberAction(member.user_id);
    setMembers((prev) =>
      prev.map((m) =>
        m.user_id === member.user_id ? { ...m, role: nextRole } : m,
      ),
    );
    try {
      const res = await fetch(`/api/account/members/${member.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!res.ok) {
        // Revert the optimistic flip. The toast on its own wasn't
        // enough — the dropdown was left showing the new role
        // forever, so the next interaction operated on a wrong
        // baseline (re-trying the same change would no-op via the
        // `member.role === nextRole` guard at the top).
        setMembers((prev) =>
          prev.map((m) =>
            m.user_id === member.user_id ? { ...m, role: previousRole } : m,
          ),
        );
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || 'Failed to update role');
        return;
      }
      toast.success(`Updated ${member.full_name || 'member'} to ${nextRole}`);
    } catch (err) {
      // Same revert on network failure.
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === member.user_id ? { ...m, role: previousRole } : m,
        ),
      );
      console.error('[MembersTab] role change error:', err);
      toast.error('Could not reach the server');
    } finally {
      setPendingMemberAction(null);
    }
  }

  async function handleRemove() {
    if (!removingMember) return;
    setPendingMemberAction(removingMember.user_id);
    try {
      const res = await fetch(
        `/api/account/members/${removingMember.user_id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || 'Failed to remove member');
        return;
      }
      toast.success(`Removed ${removingMember.full_name || 'member'}`);
      setMembers((prev) =>
        prev.filter((m) => m.user_id !== removingMember.user_id),
      );
      setRemovingMember(null);
    } catch (err) {
      console.error('[MembersTab] remove error:', err);
      toast.error('Could not reach the server');
    } finally {
      setPendingMemberAction(null);
    }
  }

  function toggleSelected(userId: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }

  /** Remove every ticked teammate, one request each; failures stay ticked. */
  async function handleBulkRemove() {
    const targets = members.filter((m) => selected.has(m.user_id));
    if (targets.length === 0) return;
    setBulkRemoving(true);
    const removed: string[] = [];
    for (const m of targets) {
      try {
        const res = await fetch(`/api/account/members/${m.user_id}`, { method: 'DELETE' });
        if (res.ok) {
          removed.push(m.user_id);
        } else {
          const payload = await res.json().catch(() => ({}));
          toast.error(`${m.full_name || 'A member'}: ${payload.error || 'could not be removed'}`);
        }
      } catch {
        toast.error(`${m.full_name || 'A member'}: could not reach the server`);
      }
    }
    setBulkRemoving(false);
    if (removed.length > 0) {
      setMembers((prev) => prev.filter((m) => !removed.includes(m.user_id)));
      setSelected((prev) => new Set([...prev].filter((id) => !removed.includes(id))));
      toast.success(removed.length === 1 ? 'Removed 1 member' : `Removed ${removed.length} members`);
    }
    setConfirmBulk(false);
  }

  async function handleRevoke(invite: Invitation) {
    try {
      const res = await fetch(`/api/account/invitations/${invite.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || 'Failed to revoke invitation');
        return;
      }
      toast.success('Invitation revoked');
      setInvitations((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (err) {
      console.error('[MembersTab] revoke error:', err);
      toast.error('Could not reach the server');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <section className="animate-in fade-in-50 space-y-6 duration-200">
      <SettingsPanelHead
        title="Team members"
        description="People with access to this account. Roles control what each teammate can do."
        action={
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<a href={docHref('team')} target="_blank" rel="noopener noreferrer" />}
          >
            Documentation
            <MdOutlineOpenInNew className="size-4" />
          </Button>
        }
      />

      {/* One hidden file input, shared by every row's camera overlay. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onAvatarFileChange}
      />

      {/* Search the roster, and add someone beside it. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members..."
            aria-label="Search members"
            // Underline only, as on the other settings lists.
            className="h-10 rounded-none border-0 border-b border-border bg-transparent pr-0 pl-6 focus-visible:border-primary focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        <RequireRole min="admin">
          <div className="flex shrink-0 items-center gap-2">
            {/* Grey until teammates are ticked; then removes them. */}
            <Button
              variant="outline"
              onClick={() => setConfirmBulk(true)}
              disabled={selected.size === 0}
              title={selected.size === 0 ? 'Tick members to remove them' : undefined}
              className={cn(
                'h-10 disabled:opacity-100',
                selected.size === 0 ? 'text-muted-foreground' : 'text-foreground',
              )}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
            <Button
              onClick={() => setInviteOpen(true)}
              className="h-10 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-4" />
              Add member
            </Button>
          </div>
        </RequireRole>
      </div>

      {/* Roster */}
      <Card>
        <CardContent className="p-0">
          {visibleMembers.length === 0 && visibleInvites.length === 0 && search.trim() !== "" && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No members match “{search.trim()}”.
            </p>
          )}
          <ul className="divide-y divide-border">
            {visibleMembers.map((member) => {
              const roleMeta = ROLE_META[member.role];
              const RoleIcon = roleMeta.icon;
              const isSelf = member.user_id === user?.id;
              const isOwnerRow = member.role === 'owner';
              const isBusy = pendingMemberAction === member.user_id;
              const presence = getPresence(member.user_id);
              const presenceRow = getRow(member.user_id);
              const presenceText = presenceLabel(
                presence,
                presenceRow?.last_seen_at ?? null,
                now,
              );

              return (
                <li
                  key={member.user_id}
                  // Mobile: stack identity (avatar+name+email) above the
                  // role/remove actions so the role dropdown's fixed
                  // 128px width doesn't force the name into a 50-pixel
                  // truncation. Desktop (sm+): everything inline as
                  // before.
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    {canManageMembers && (
                      <span
                        className="flex shrink-0"
                        title={
                          isOwnerRow
                            ? "The owner can't be removed"
                            : isSelf
                              ? "You can't remove yourself"
                              : undefined
                        }
                      >
                        <Checkbox
                          checked={selected.has(member.user_id)}
                          onCheckedChange={(on) => toggleSelected(member.user_id, on)}
                          disabled={isOwnerRow || isSelf}
                          aria-label={`Select ${member.full_name || member.email || 'member'}`}
                        />
                      </span>
                    )}
                    <div className="group relative shrink-0">
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Avatar className="size-9 shrink-0">
                              {member.avatar_url ? (
                                <AvatarImage
                                  src={member.avatar_url}
                                  alt={member.full_name || 'Member'}
                                />
                              ) : null}
                              <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                                {(member.full_name || member.email || 'U')
                                  .charAt(0)
                                  .toUpperCase()}
                              </AvatarFallback>
                              {/* role+label so screen readers announce
                                  presence — the hover tooltip alone isn't
                                  reachable by keyboard/AT on a non-focusable
                                  avatar. */}
                              <AvatarBadge
                                role="img"
                                aria-label={presenceText}
                                className={PRESENCE_DOT_CLASS[presence]}
                              />
                            </Avatar>
                          }
                        />
                        <TooltipContent>{presenceText}</TooltipContent>
                      </Tooltip>

                      {/* Admin+ can set any teammate's photo. Overlay sits
                          on the avatar and shows on hover/focus (or while
                          uploading). */}
                      {canManageMembers && (
                        <button
                          type="button"
                          onClick={() => pickAvatar(member.user_id)}
                          disabled={uploadingId === member.user_id}
                          title="Change photo"
                          aria-label={`Change ${member.full_name || 'member'}'s photo`}
                          className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white opacity-0 outline-none transition-opacity group-hover:opacity-100 focus-visible:opacity-100 ${
                            uploadingId === member.user_id ? 'opacity-100' : ''
                          }`}
                        >
                          {uploadingId === member.user_id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Camera className="size-4" />
                          )}
                        </button>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {member.full_name || 'Unnamed'}
                        </span>
                        {isSelf && (
                          <Badge className="bg-muted text-muted-foreground border-border text-[10px] uppercase tracking-wide">
                            You
                          </Badge>
                        )}
                      </div>
                      {member.email && (
                        <p className="truncate text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions cluster. On mobile this is its own row
                      below the identity block; on desktop it sits
                      inline. Items align to the start on mobile so the
                      role dropdown lines up under the avatar. */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${roleMeta.className}`}
                    >
                      {RoleIcon && <RoleIcon className="size-3.5" />}
                      {roleMeta.label}
                    </span>

                    {/* Role, access and removal live in one window behind
                        the pencil. Admin+ only; never the owner (that's a
                        transfer) and never yourself. */}
                    {canManageMembers && !isOwnerRow && !isSelf && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditingMember(member)}
                        disabled={isBusy}
                        title="Edit role and access"
                        aria-label={`Edit ${member.full_name || 'member'}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}

            {/* Invites not yet accepted, in the same list: a Pending tag
                by the name, and revoke where a member has the pencil.
                Admin+ only — nobody else loads them. */}
            {canManageMembers &&
              visibleInvites.map((inv) => {
                const inviteRoleMeta = ROLE_META[inv.role];
                const InviteRoleIcon = inviteRoleMeta.icon;
                return (
                  <li
                    key={inv.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      {/* Lines up with the members' checkboxes. */}
                      <span aria-hidden className="size-4 shrink-0" />
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Mail className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {inv.label || 'Untitled invite'}
                          </span>
                          <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800 uppercase dark:bg-amber-500/15 dark:text-amber-300">
                            Pending
                          </span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          Invite link · {fmtExpiresIn(inv.expires_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${inviteRoleMeta.className}`}
                      >
                        {InviteRoleIcon && <InviteRoleIcon className="size-3.5" />}
                        {inviteRoleMeta.label}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRevoke(inv)}
                        // An invite link is shown once, at creation — so
                        // re-sharing means revoking and adding again.
                        title="Revoke invite — the link stops working. To re-share, revoke it and add the member again."
                        aria-label={`Revoke invite ${inv.label || ''}`.trim()}
                        className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                      >
                        <MailX className="size-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
          </ul>
        </CardContent>
      </Card>

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreated={loadEverything}
      />

      <EditMemberDialog
        member={editingMember}
        onClose={() => setEditingMember(null)}
        onUpdateRole={async (member, role) => {
          await handleRoleChange(member, role);
          setEditingMember(null);
        }}
        onRemove={(member) => {
          // The existing confirmation takes it from here.
          setEditingMember(null);
          setRemovingMember(member);
        }}
      />

      <Dialog
        open={removingMember !== null}
        onOpenChange={(open) => {
          if (!open) setRemovingMember(null);
        }}
      >
        <DialogContent className="bg-popover border-border sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-popover-foreground">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              Remove member
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Remove{' '}
              <span className="font-medium text-muted-foreground">
                {removingMember?.full_name || 'this teammate'}
              </span>{' '}
              from the account? They&apos;ll be signed out of this account
              and given a fresh personal account on their next sign-in. Their
              login isn&apos;t deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-popover border-border">
            <Button
              variant="outline"
              onClick={() => setRemovingMember(null)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRemove}
              disabled={!!pendingMemberAction}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {pendingMemberAction ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove member'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove the ticked teammates */}
      <Dialog open={confirmBulk} onOpenChange={(open) => !bulkRemoving && setConfirmBulk(open)}>
        <DialogContent className="bg-popover border-border sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-popover-foreground">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              {selected.size === 1 ? 'Remove member' : `Remove ${selected.size} members`}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Remove{' '}
              <span className="font-medium text-foreground">
                {members
                  .filter((m) => selected.has(m.user_id))
                  .map((m) => m.full_name || m.email || 'a teammate')
                  .join(', ')}
              </span>{' '}
              from the account? They&apos;ll be signed out of this account and given a fresh
              personal account on their next sign-in. Their logins aren&apos;t deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-popover border-border">
            <Button
              variant="outline"
              onClick={() => setConfirmBulk(false)}
              disabled={bulkRemoving}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkRemove}
              disabled={bulkRemoving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {bulkRemoving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/**
 * One teammate's role and access: pick a role, see what it grants
 * (ROLE_PERMISSIONS, granted ones only), save it — or remove them from
 * the account.
 */
function EditMemberDialog({
  member,
  onClose,
  onUpdateRole,
  onRemove,
}: {
  member: Member | null;
  onClose: () => void;
  onUpdateRole: (member: Member, role: AccountRole) => Promise<void>;
  onRemove: (member: Member) => void;
}) {
  const [role, setRole] = useState<AccountRole>('agent');
  const [saving, setSaving] = useState(false);

  // Start from the member's own role each time the window opens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (member) setRole(member.role);
  }, [member]);

  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="border-border bg-popover sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">Edit member</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {member?.full_name || 'Teammate'}
            {member?.email ? ` · ${member.email}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <p id="edit-member-role" className="text-sm font-medium text-foreground">
              Role
            </p>
            <Select value={role} onValueChange={(v) => v && setRole(v as AccountRole)}>
              <SelectTrigger
                aria-labelledby="edit-member-role"
                className="w-full border-border bg-transparent data-[size=default]:h-11"
              >
                <SelectValue>
                  {EDITABLE_ROLES.find((r) => r.value === role)?.label ?? role}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start" alignItemWithTrigger={false}>
                {EDITABLE_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value} className="py-2">
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">{r.label}</span>
                      <span className="text-xs text-muted-foreground">{r.hint}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Permissions</p>
            <ul className="space-y-1.5">
              {ROLE_PERMISSIONS.filter((p) => hasMinRole(role, p.min)).map((p) => (
                <li key={p.label} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  {p.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="border-border bg-popover sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => member && onRemove(member)}
            disabled={saving}
            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <Trash2 className="size-4" />
            Remove from account
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!member) return;
                setSaving(true);
                await onUpdateRole(member, role);
                setSaving(false);
              }}
              disabled={saving || !member || role === member.role}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Update role
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
