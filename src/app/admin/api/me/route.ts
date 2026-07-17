import { NextResponse } from 'next/server';
import { getAdminUser } from '../../_lib/auth';

/**
 * Whether the current session is an allowlisted admin. The admin login
 * page calls this after sign-in to decide whether to enter the panel or
 * reject a non-admin account.
 */
export async function GET() {
  const user = await getAdminUser();
  return NextResponse.json({ admin: !!user, email: user?.email ?? null });
}
