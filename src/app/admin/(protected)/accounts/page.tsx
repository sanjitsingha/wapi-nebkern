import {
  computeSubscription,
  type SubscriptionStatus,
} from '@/lib/billing/subscription';
import { adminDb } from '../../_lib/admin-db';
import { AccountsTable, type AccountView } from '../../_components/accounts-table';

export const dynamic = 'force-dynamic';

interface AccountRow {
  id: string;
  name: string;
  owner_user_id: string;
  plan: string | null;
  subscription_status: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  email: string | null;
  account_id: string | null;
}

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const db = adminDb();

  const [accountsRes, profilesRes] = await Promise.all([
    db
      .from('accounts')
      .select(
        'id, name, owner_user_id, plan, subscription_status, trial_started_at, trial_ends_at, created_at',
      )
      .order('created_at', { ascending: false }),
    db.from('profiles').select('user_id, email, account_id'),
  ]);

  const accounts = (accountsRes.data ?? []) as AccountRow[];
  const profiles = (profilesRes.data ?? []) as ProfileRow[];

  const emailByUserId = new Map<string, string | null>();
  const memberCountByAccount = new Map<string, number>();
  for (const p of profiles) {
    emailByUserId.set(p.user_id, p.email);
    if (p.account_id) {
      memberCountByAccount.set(
        p.account_id,
        (memberCountByAccount.get(p.account_id) ?? 0) + 1,
      );
    }
  }

  const rows: AccountView[] = accounts.map((a) => {
    const sub = computeSubscription(a);
    return {
      id: a.id,
      name: a.name,
      ownerEmail: emailByUserId.get(a.owner_user_id) ?? null,
      plan: sub.plan,
      status: sub.status as SubscriptionStatus,
      trialDaysLeft: sub.isTrial ? sub.trialDaysLeft : 0,
      isTrial: sub.isTrial,
      memberCount: memberCountByAccount.get(a.id) ?? 0,
      trialEndsAt: a.trial_ends_at,
      createdAt: a.created_at,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {accounts.length} tenant{accounts.length === 1 ? '' : 's'} using the app.
        </p>
      </div>
      <AccountsTable rows={rows} initialFilter={filter ?? 'all'} />
    </div>
  );
}
