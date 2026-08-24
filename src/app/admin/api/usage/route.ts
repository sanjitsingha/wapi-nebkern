import { NextResponse } from 'next/server';
import { getAdminUser } from '../../_lib/auth';
import { collectSupabaseUsage } from '../../_lib/supabase-usage';

export const dynamic = 'force-dynamic';

/**
 * GET /admin/api/usage — live Supabase resource usage & free-tier quota stats, admin-only.
 * Polled by the UsageDashboard component for automatic updates.
 */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const usage = await collectSupabaseUsage();
  return NextResponse.json(usage, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
