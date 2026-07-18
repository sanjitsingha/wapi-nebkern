import { adminDb } from '../../_lib/admin-db';
import { isAdminEmail } from '../../_lib/auth';
import { UsersTable, type UserView } from '../../_components/users-table';

export const dynamic = 'force-dynamic';

interface ProfileRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  account_id: string | null;
  account_role: string | null;
}

interface AccountRow {
  id: string;
  name: string;
  owner_user_id: string;
}

/** A `banned_until` in the future means the account is currently suspended. */
function isSuspended(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil || bannedUntil === 'none') return false;
  const t = Date.parse(bannedUntil);
  return !Number.isNaN(t) && t > Date.now();
}

export default async function AdminUsersPage() {
  const db = adminDb();

  // Auth users are the source of truth for existence + ban status; profiles
  // carry the app-side name / account linkage; accounts tell us who owns what.
  const [profilesRes, accountsRes, authRes] = await Promise.all([
    db
      .from('profiles')
      .select('user_id, email, full_name, account_id, account_role'),
    db.from('accounts').select('id, name, owner_user_id'),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const accounts = (accountsRes.data ?? []) as AccountRow[];
  const authUsers = authRes.data?.users ?? [];

  const profileByUser = new Map(profiles.map((p) => [p.user_id, p]));
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));
  const ownerUserIds = new Set(accounts.map((a) => a.owner_user_id));

  const rows: UserView[] = authUsers
    .map((u): UserView => {
      const p = profileByUser.get(u.id);
      const email = u.email ?? p?.email ?? null;
      return {
        id: u.id,
        email,
        fullName: p?.full_name ?? null,
        accountName: p?.account_id
          ? (accountNameById.get(p.account_id) ?? null)
          : null,
        role: p?.account_role ?? null,
        isOwner: ownerUserIds.has(u.id),
        isAdmin: isAdminEmail(email),
        suspended: isSuspended(u.banned_until),
        createdAt: u.created_at ?? null,
        lastSignInAt: u.last_sign_in_at ?? null,
      };
    })
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} user{rows.length === 1 ? '' : 's'} across all workspaces.
        </p>
      </div>
      <UsersTable rows={rows} />
    </div>
  );
}
