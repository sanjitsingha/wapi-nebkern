import { getAccountViews } from '../../_lib/admin-data';
import { AccountsTable } from '../../_components/accounts-table';
import { CacheNote, PageHeader } from '../../_components/ui';

export const dynamic = 'force-dynamic';

// No query of its own: `getAccountViews` folds the shared, cached
// `accounts` and `profiles` reads into a resolved view. This page used
// to fetch both tables itself, duplicating what Overview had just read.

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const rows = await getAccountViews();

  const trialing = rows.filter((r) => r.isTrial).length;
  const paying = rows.filter((r) => r.status === 'active').length;

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Every tenant using the app, with their effective subscription state."
        meta={
          <>
            <CacheNote />
            <span>·</span>
            <span>{rows.length} total</span>
            <span>·</span>
            <span>{paying} paying</span>
            <span>·</span>
            <span>{trialing} on trial</span>
          </>
        }
      />
      <AccountsTable rows={rows} initialFilter={filter ?? 'all'} />
    </>
  );
}
