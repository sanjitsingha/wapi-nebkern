// ============================================================
// Audit write path — server only. One resilient entry point that every
// tracked event calls. Writes through the service-role client so the row
// lands regardless of the caller's RLS (the audit_logs table has no
// client INSERT policy) and so destructive actions still record their
// actor.
//
// BEST EFFORT: logging must never break the action it describes. Every
// failure is swallowed with a console.error — a missing log line is far
// less bad than a failed member removal or payment.
// ============================================================

import { supabaseAdmin } from '@/lib/billing/admin-client';
import type { AuditAction } from './events';

export interface AuditInput {
  accountId: string;
  /** Who did it. Omit / null for a system actor (cron, webhook). */
  actorUserId?: string | null;
  /** Actor's display name. Looked up from profiles when omitted. */
  actorName?: string | null;
  action: AuditAction | string;
  targetType?: string | null;
  /** Any identifier — uuid, plan key, phone. Coerced to text. */
  targetId?: string | number | null;
  targetLabel?: string | null;
  metadata?: Record<string, unknown> | null;
  /** The request, so IP + user-agent can be captured. */
  request?: Request;
}

/** First hop of X-Forwarded-For, then X-Real-IP. Null when unknown. */
function clientIp(request?: Request): string | null {
  if (!request) return null;
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || null;
  return request.headers.get('x-real-ip')?.trim() || null;
}

export async function logAudit(input: AuditInput): Promise<void> {
  try {
    const db = supabaseAdmin();

    let actorName = input.actorName ?? null;
    if (!actorName && input.actorUserId) {
      const { data } = await db
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', input.actorUserId)
        .maybeSingle();
      actorName = data?.full_name || data?.email || null;
    }

    await db.from('audit_logs').insert({
      account_id: input.accountId,
      actor_user_id: input.actorUserId ?? null,
      actor_name: actorName,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId != null ? String(input.targetId) : null,
      target_label: input.targetLabel ?? null,
      metadata: input.metadata ?? {},
      ip: clientIp(input.request),
      user_agent:
        input.request?.headers.get('user-agent')?.slice(0, 500) ?? null,
    });
  } catch (err) {
    console.error('[audit] failed to log', input.action, err);
  }
}
