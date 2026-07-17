import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

/**
 * Admin panel access control — an email allowlist.
 *
 * `ADMIN_EMAILS` is a comma-separated list of the operator emails allowed
 * into `/admin`. An admin signs in with their ordinary Supabase account
 * (the same auth as tenants); membership in the allowlist is what grants
 * back-office access. Empty/unset ⇒ nobody is an admin (safe default).
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

/**
 * The signed-in user IFF they're an allowlisted admin, else null. Used by
 * the protected layout and every admin API route as the gate. Reads the
 * session from cookies via the shared SSR client.
 */
export async function getAdminUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}
