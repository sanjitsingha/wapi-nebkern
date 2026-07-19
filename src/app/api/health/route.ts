import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/health — public, unauthenticated liveness probe.
 *
 * Built for external uptime monitors (UptimeRobot / BetterStack / Pingdom)
 * and the admin System Health console's "API" check. Confirms the app is
 * serving AND that its database is reachable, timing the round trip. It
 * deliberately leaks NOTHING sensitive — no config, no counts — just an
 * overall status and DB reachability/latency.
 *
 *   200 { status: 'ok' | 'degraded', ... }   — serving; DB reachable
 *   503 { status: 'down', ... }              — DB unreachable
 *
 * `degraded` means the DB answered but slowly (see DEGRADED_MS).
 */
export const dynamic = 'force-dynamic';

const DEGRADED_MS = 800;

export async function GET() {
  const startedAt = Date.now();
  let dbReachable = false;
  let latencyMs: number | null = null;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const t0 = Date.now();
    // Lightweight, RLS-safe probe: a HEAD count against a table anon may
    // read (billing_plans SELECT is public for active plans). No rows are
    // transferred — just the round trip.
    const { error } = await supabase
      .from('billing_plans')
      .select('id', { count: 'exact', head: true });
    latencyMs = Date.now() - t0;
    dbReachable = !error;
  } catch {
    dbReachable = false;
  }

  const status = !dbReachable
    ? 'down'
    : latencyMs !== null && latencyMs > DEGRADED_MS
      ? 'degraded'
      : 'ok';

  return NextResponse.json(
    {
      status,
      db: { reachable: dbReachable, latencyMs },
      tookMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    {
      status: status === 'down' ? 503 : 200,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    },
  );
}
