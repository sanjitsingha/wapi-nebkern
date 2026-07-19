import { NextResponse } from 'next/server';
import { getAdminUser } from '../../_lib/auth';
import { collectSystemHealth } from '../../_lib/system-health';

export const dynamic = 'force-dynamic';

/**
 * GET /admin/api/system — the live system-health snapshot, admin-only.
 * The console polls this to refresh without a full page reload.
 */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const health = await collectSystemHealth();
  return NextResponse.json(health, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
