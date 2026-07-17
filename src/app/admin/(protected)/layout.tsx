import { redirect } from 'next/navigation';

import { getAdminUser } from '../_lib/auth';
import { AdminShell } from '../_components/admin-shell';

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
  return <AdminShell email={user.email ?? null}>{children}</AdminShell>;
}
