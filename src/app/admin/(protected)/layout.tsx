import { redirect } from 'next/navigation';

import { getAdminUser } from '../_lib/auth';
import { getAccountsIndex } from '../_lib/admin-data';
import { AdminShell } from '../_components/admin-shell';
import '../admin.css';

// The gate reads the session cookie, so this segment must never be
// statically cached — re-check on every request.
export const dynamic = 'force-dynamic';

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAdminUser();
  if (!user) redirect('/admin/login');

  // Feeds ⌘K. Not an extra query: it is derived from the same cached
  // `accounts` read the pages below use, and React's `cache()` collapses
  // the layout's call and the page's into one.
  const accounts = await getAccountsIndex();

  return (
    <AdminShell email={user.email ?? null} accounts={accounts}>
      {children}
    </AdminShell>
  );
}
