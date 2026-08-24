// ============================================================
// /api/account/members/[userId]
//
//   PATCH  — change a member's role.   Admin+.
//   DELETE — remove a member.          Admin+.
//
// Both delegate to SECURITY DEFINER RPCs from migration 018:
//   - set_member_role(p_user_id, p_new_role)
//   - remove_account_member(p_user_id)
//
// The RPCs do the *real* authorisation work — caller must be
// admin+, target must be in caller's account, target can't be the
// owner, can't be self. The TS layer here only forwards the call
// and maps Postgres SQLSTATEs back to HTTP statuses.
// ============================================================

import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { isAccountRole } from "@/lib/auth/roles";
import { supabaseAdmin } from "@/lib/billing/admin-client";
import { logAudit } from "@/lib/audit/log";
import { AUDIT } from "@/lib/audit/events";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";

// Map known SQLSTATEs from the RPCs (see migration 018) onto HTTP
// statuses. The `error.code` field is the SQLSTATE; the `message`
// is the human-readable RAISE message we put in the migration.
function rpcErrorToResponse(err: PostgrestError): NextResponse {
  if (err.code === "42501") {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err.code === "22023") {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  console.error("[members route] unexpected RPC error:", err);
  return NextResponse.json(
    { error: "Failed to update member" },
    { status: 500 },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const ctx = await requireRole("admin");

    const limit = checkRateLimit(
      `admin:memberRole:${ctx.userId}`,
      RATE_LIMITS.adminAction,
    );
    if (!limit.success) return rateLimitResponse(limit);

    const { userId } = await params;

    const body = (await request.json().catch(() => null)) as
      | { role?: unknown; avatar_url?: unknown }
      | null;

    // Avatar update — an admin sets a teammate's profile picture. RLS only
    // lets a user update their OWN profile row (migration 017), so this
    // goes through the service role, scoped to a target we first confirm is
    // a member of the caller's account. Kept separate from the role path.
    if (body && "avatar_url" in body) {
      const avatarUrl = body.avatar_url;
      if (
        avatarUrl !== null &&
        (typeof avatarUrl !== "string" ||
          avatarUrl.length > 1000 ||
          !/^https?:\/\//i.test(avatarUrl))
      ) {
        return NextResponse.json(
          { error: "Invalid avatar_url" },
          { status: 400 },
        );
      }

      // The caller (admin, via RLS is_account_member) can read teammate
      // profiles; use that to confirm the target is in this account before
      // the service-role write.
      const { data: target } = await ctx.supabase
        .from("profiles")
        .select("account_id, full_name, email")
        .eq("user_id", userId)
        .maybeSingle();
      if (!target || target.account_id !== ctx.accountId) {
        return NextResponse.json(
          { error: "That member is not part of your account" },
          { status: 404 },
        );
      }

      const { error } = await supabaseAdmin()
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("user_id", userId)
        .eq("account_id", ctx.accountId);
      if (error) {
        console.error("[members route] avatar update failed:", error);
        return NextResponse.json(
          { error: "Failed to update photo" },
          { status: 500 },
        );
      }

      await logAudit({
        accountId: ctx.accountId,
        actorUserId: ctx.userId,
        action: AUDIT.MEMBER_PHOTO_CHANGED,
        targetType: "member",
        targetId: userId,
        targetLabel: target.full_name || target.email || null,
        request,
      });
      return NextResponse.json({ ok: true, avatar_url: avatarUrl });
    }

    const role = body?.role;

    if (!isAccountRole(role)) {
      return NextResponse.json(
        { error: "'role' must be one of owner, admin, agent, viewer" },
        { status: 400 },
      );
    }

    // The RPC blocks promotion to / demotion from owner, but
    // surface the friendlier 400 before crossing the wire too.
    if (role === "owner") {
      return NextResponse.json(
        {
          error:
            "Use POST /api/account/transfer-ownership to promote a member to owner",
        },
        { status: 400 },
      );
    }

    // Snapshot the current role/name for the audit trail before the RPC
    // flips it.
    const { data: before } = await ctx.supabase
      .from("profiles")
      .select("account_role, full_name, email")
      .eq("user_id", userId)
      .maybeSingle();

    const { error } = await ctx.supabase.rpc("set_member_role", {
      p_user_id: userId,
      p_new_role: role,
    });

    if (error) return rpcErrorToResponse(error);

    await logAudit({
      accountId: ctx.accountId,
      actorUserId: ctx.userId,
      action: AUDIT.MEMBER_ROLE_CHANGED,
      targetType: "member",
      targetId: userId,
      targetLabel: before?.full_name || before?.email || null,
      metadata: { from: before?.account_role ?? null, to: role },
      request,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const ctx = await requireRole("admin");

    const limit = checkRateLimit(
      `admin:memberRemove:${ctx.userId}`,
      RATE_LIMITS.adminAction,
    );
    if (!limit.success) return rateLimitResponse(limit);

    const { userId } = await params;

    // Name for the log, captured before the member leaves the account.
    const { data: before } = await ctx.supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", userId)
      .maybeSingle();

    const { data, error } = await ctx.supabase.rpc("remove_account_member", {
      p_user_id: userId,
    });

    if (error) return rpcErrorToResponse(error);

    await logAudit({
      accountId: ctx.accountId,
      actorUserId: ctx.userId,
      action: AUDIT.MEMBER_REMOVED,
      targetType: "member",
      targetId: userId,
      targetLabel: before?.full_name || before?.email || null,
      request,
    });

    return NextResponse.json({ ok: true, newPersonalAccountId: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
