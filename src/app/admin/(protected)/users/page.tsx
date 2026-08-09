import { getAccounts, getAuthUsers, getProfiles } from '../../_lib/admin-data';
import { isAdminEmail } from '../../_lib/auth';
import { UsersTable, type UserView } from '../../_components/users-table';
import { CacheNote, PageHeader } from '../../_components/ui';

export const dynamic = 'force-dynamic';

// Three reads, all shared and all cached. This page used to issue its
// own `profiles` and `accounts` queries alongside the auth list — the
// same two tables Overview and Accounts had already read.
//
// Auth users are the source of truth for existence and ban status;
// profiles carry the app-side name and account link; accounts say who
// owns what.

/** A `banned_until` in the future means the account is currently suspended. */
function isSuspended(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil || bannedUntil === 'none') return false;
  const t = Date.parse(bannedUntil);
  return !Number.isNaN(t) && t > Date.now();
}

export default async function AdminUsersPage() {
  const [profiles, accounts, authUsers] = await Promise.all([
    getProfiles(),
    getAccounts(),
    getAuthUsers(),
  ]);

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
        suspended: isSuspended(u.bannedUntil),
        // Someone who signed up but never entered the emailed code. They
        // exist in auth.users and hold the address, so they block a
        // re-signup — which is exactly why they need to be visible here.
        emailConfirmed: u.emailConfirmedAt != null,
        createdAt: u.createdAt ?? null,
        lastSignInAt: u.lastSignInAt ?? null,
      };
    })
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  const suspended = rows.filter((r) => r.suspended).length;
  const unconfirmed = rows.filter((r) => !r.emailConfirmed).length;

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone with a login, across all workspaces."
        meta={
          <>
            <CacheNote />
            <span>·</span>
            <span>{rows.length} total</span>
            {suspended > 0 && (
              <>
                <span>·</span>
                <span>{suspended} suspended</span>
              </>
            )}
            {unconfirmed > 0 && (
              <>
                <span>·</span>
                <span>{unconfirmed} unconfirmed</span>
              </>
            )}
          </>
        }
      />
      <UsersTable rows={rows} />
    </>
  );
}
