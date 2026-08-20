// ============================================================
// Server-side account context — for API routes and server
// components. Reads the caller's profile + account in one round
// trip and verifies role on demand.
//
// IMPORTANT: this module is server-only. It imports the Supabase
// SSR client (`@/lib/supabase/server`), which reads `next/headers`
// cookies. Importing it from a client component will fail at
// build time with the standard Next.js "You're importing a
// component that needs `next/headers`" error — that's the
// boundary check; we don't need the `server-only` package.
//
// Calling convention
// ------------------
// API routes don't need to redo `supabase.auth.getUser()` — they
// receive a fully-loaded context from `requireRole`:
//
//   try {
//     const ctx = await requireRole("admin");
//     // ctx.supabase — the SSR client (RLS scoped to this user)
//     // ctx.userId  — auth.uid()
//     // ctx.accountId / ctx.role / ctx.account
//   } catch (err) {
//     return errorResponse(err); // see toErrorResponse() below
//   }
// ============================================================

import { cache } from "react";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { hasMinRole, isAccountRole, type AccountRole } from "./roles";

// ------------------------------------------------------------
// Errors
//
// Custom classes so API routes can map a single `catch` to the
// right HTTP status without sprinkling 401/403 strings everywhere.
// ------------------------------------------------------------

export class UnauthorizedError extends Error {
  readonly status = 401 as const;
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403 as const;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * The account is inside its deletion window (migration 086).
 *
 * Separate from ForbiddenError because the client has to tell the two
 * apart: a role failure means "ask someone with more access", while
 * this means "the account is locked and there is a deadline to undo
 * it". The `code` is what the fetch wrappers switch on to send someone
 * to the lockout screen instead of showing a generic toast.
 */
export class AccountDeletedError extends Error {
  readonly status = 403 as const;
  readonly code = "account_deleted" as const;
  constructor(message = "This account is scheduled for deletion") {
    super(message);
    this.name = "AccountDeletedError";
  }
}

/**
 * Convert one of the typed errors above (or anything else) into a
 * `NextResponse`. Routes can do:
 *
 *   } catch (err) {
 *     return toErrorResponse(err);
 *   }
 *
 * Unknown errors collapse to 500 with the generic message — we
 * never leak `err.message` for non-classified errors to keep
 * server internals out of the wire.
 */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof AccountDeletedError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.status },
    );
  }
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[toErrorResponse] uncategorized error:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

// ------------------------------------------------------------
// Account context
// ------------------------------------------------------------

export interface AccountContext {
  /** Supabase SSR client, RLS scoped to the calling user. */
  supabase: SupabaseClient;
  /** `auth.uid()` for the caller. Always defined when this resolves. */
  userId: string;
  /** Caller's account_id from their profile row. */
  accountId: string;
  /** Caller's role within their account. */
  role: AccountRole;
  /** Lightweight account meta — id + name. */
  account: { id: string; name: string };
}

/**
 * Resolve the caller's user + account + role in one round trip.
 *
 * Throws `UnauthorizedError` if there's no Supabase session.
 * Throws `ForbiddenError` if the profile is missing account
 * fields (shouldn't happen post-017 migration; defensive guard
 * against profile rows that pre-date the backfill or were
 * inserted by hand).
 *
 * Use `requireRole(min)` instead when the route also needs a
 * minimum-role check — it's a thin wrapper over this.
 */
/**
 * Read account context off the user's `app_metadata`, which
 * `auth.getUser()` already returned — no second round trip.
 *
 * Migration 079 mirrors `account_id`, `account_role` and `account_name`
 * there and keeps them in step with `profiles` / `accounts` via
 * triggers. `getUser()` reads the live auth row rather than the copy
 * baked into the client's JWT, so a role change is visible on the next
 * request without waiting for a token refresh.
 *
 * Returns null when any key is absent — a session from before 079, or
 * the brief window during signup before the trigger has run — and the
 * caller falls back to querying `profiles`.
 */
function claimsFromAppMetadata(user: User): {
  accountId: string;
  role: AccountRole;
  accountName: string;
  pendingDeletion: boolean;
} | null {
  const meta = user.app_metadata as Record<string, unknown> | undefined;
  if (!meta) return null;

  const accountId = meta.account_id;
  const role = meta.account_role;
  const accountName = meta.account_name;

  if (
    typeof accountId !== "string" ||
    typeof role !== "string" ||
    typeof accountName !== "string" ||
    !isAccountRole(role)
  ) {
    return null;
  }
  // Absent on sessions predating 086. Treated as "not deleted" so an
  // old session is not locked out by a key it never had — the fallback
  // query below reads the column directly for anyone the fast path
  // rejects, and the trigger stamps the key on the next account change.
  const pendingDeletion = meta.pending_deletion === true;
  return { accountId, role, accountName, pendingDeletion };
}

async function loadCurrentAccount(): Promise<AccountContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    throw new UnauthorizedError();
  }

  // Fast path: everything we need arrived with the user object.
  const claims = claimsFromAppMetadata(user);
  if (claims) {
    // The lock sits ahead of the return, so every one of the 68 routes
    // that calls this is closed the moment deletion is confirmed —
    // middleware only covers page navigation, never /api.
    if (claims.pendingDeletion) {
      throw new AccountDeletedError();
    }
    return {
      supabase,
      userId: user.id,
      accountId: claims.accountId,
      role: claims.role,
      account: { id: claims.accountId, name: claims.accountName },
    };
  }

  // Fallback — the original query. Reached only by sessions predating
  // migration 079 and by a profile the trigger has not stamped yet.
  //
  // Selecting through the FK gives us the account name in one
  // query — `account:accounts!inner(id,name)` is Supabase's
  // explicit-join syntax. `!inner` so a NULL account_id (which
  // shouldn't exist) yields no row and trips the guard below
  // rather than silently returning a half-populated profile.
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "account_id, account_role, account:accounts!inner(id, name, deletion_requested_at)",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[getCurrentAccount] profile fetch error:", error);
    throw new ForbiddenError("Could not load account context");
  }
  if (!data || !data.account_id || !data.account_role || !data.account) {
    // Pre-migration profile, or a manual insert that skipped the
    // signup trigger. The user is authenticated but the app has
    // no way to scope their queries — treat as forbidden.
    throw new ForbiddenError("Profile is not linked to an account");
  }
  if (!isAccountRole(data.account_role)) {
    // The DB enum should make this impossible, but a future
    // migration that broadens the enum without updating TS would
    // hit this — surface it rather than silently widening.
    throw new ForbiddenError(`Unknown account role: ${data.account_role}`);
  }

  // Supabase's typed client returns related rows as an array even
  // for `!inner` single-record joins; normalise to a single object.
  const accountRow = Array.isArray(data.account) ? data.account[0] : data.account;

  // Same lock as the fast path. Deliberately NOT fail-open, unlike the
  // onboarding gate: letting someone through on a bad read there costs
  // a skipped paywall, letting them through here means writing to an
  // account that is on its way to being deleted.
  if (accountRow.deletion_requested_at != null) {
    throw new AccountDeletedError();
  }

  return {
    supabase,
    userId: user.id,
    accountId: data.account_id,
    role: data.account_role,
    account: { id: accountRow.id, name: accountRow.name },
  };
}

/**
 * Request-scoped memo around `loadCurrentAccount`.
 *
 * Several routes resolve the context more than once — a `getCurrentAccount`
 * in a helper plus a `requireRole` in the handler, say. React's `cache()`
 * scopes the result to the current request, so the second call is free
 * instead of repeating an auth round trip. Nothing leaks between
 * requests: the cache lifetime is the render/request pass.
 */
export const getCurrentAccount = cache(loadCurrentAccount);

/**
 * Resolve the caller's account context and enforce a minimum role.
 *
 * Throws `UnauthorizedError` / `ForbiddenError` as documented on
 * `getCurrentAccount`, plus `ForbiddenError("Insufficient role")`
 * when the caller is below `min`.
 */
export async function requireRole(min: AccountRole): Promise<AccountContext> {
  const ctx = await getCurrentAccount();
  if (!hasMinRole(ctx.role, min)) {
    throw new ForbiddenError(
      `This action requires the '${min}' role or higher`,
    );
  }
  return ctx;
}
