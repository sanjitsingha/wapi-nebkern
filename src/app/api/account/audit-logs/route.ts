// ============================================================
// GET /api/account/audit-logs
//
// The account's activity log, newest first. Admin+ only (RLS also scopes
// audit_logs to admins of the account, so this is defence in depth).
//
// Query params (all optional):
//   actor    — filter to one teammate's actions (their user_id)
//   category — one of the AuditCategory values (team, billing, …)
//   from,to  — ISO timestamps, inclusive bounds on created_at
//   limit    — page size (default 50, max 100)
//   offset   — page offset
// ============================================================

import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  actionsForCategory,
  type AuditCategory,
  type AuditLogEntry,
} from '@/lib/audit/events';

const CATEGORIES = new Set([
  'team',
  'billing',
  'conversations',
  'contacts',
  'fields',
  'calls',
  'deals',
  'broadcast',
  'channel',
  'system',
]);

export async function GET(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const { searchParams } = new URL(request.url);

    const actor = searchParams.get('actor');
    const category = searchParams.get('category');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get('limit')) || 50),
    );
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0);

    let query = ctx.supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false });

    if (actor) query = query.eq('actor_user_id', actor);
    if (category && CATEGORIES.has(category)) {
      query = query.in('action', actionsForCategory(category as AuditCategory));
    }
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error('[GET /api/account/audit-logs] fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to load activity log' },
        { status: 500 },
      );
    }

    const logs: AuditLogEntry[] = (data ?? []).map((r) => ({
      id: r.id as string,
      actorUserId: (r.actor_user_id as string | null) ?? null,
      actorName: (r.actor_name as string | null) ?? null,
      action: r.action as string,
      targetType: (r.target_type as string | null) ?? null,
      targetId: (r.target_id as string | null) ?? null,
      targetLabel: (r.target_label as string | null) ?? null,
      metadata:
        r.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata)
          ? (r.metadata as Record<string, unknown>)
          : {},
      ip: (r.ip as string | null) ?? null,
      userAgent: (r.user_agent as string | null) ?? null,
      createdAt: r.created_at as string,
    }));

    const total = count ?? logs.length;
    return NextResponse.json({
      logs,
      total,
      hasMore: offset + logs.length < total,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
