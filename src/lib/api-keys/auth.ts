import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * Authenticate an incoming request by API key (x-api-key header).
 *
 * Looks up the SHA-256 hash of the key in the `api_keys` table, validates
 * that it is not revoked and not expired, bumps last_used_at, and returns
 * the resolved account + user + scopes.
 *
 * This function uses the SUPABASE_SERVICE_ROLE_KEY so it can query the
 * api_keys table regardless of the caller's session state. It is intended
 * for server-to-server routes that do NOT require a Supabase auth cookie.
 *
 * Returns `null` when no key is provided, the key is malformed, or it does
 * not match a live row. Callers should fall back to normal Supabase session
 * auth if they want to accept both auth methods.
 */

export interface ApiKeyAuthResult {
  accountId: string;
  userId: string;
  scopes: string[];
  keyId: string;
}

const PREFIX = 'wak_';

export function hashKey(raw: string): string {
  // node:crypto is available in Next.js edge + node runtimes
  const { createHash } = require('node:crypto');
  return createHash('sha256').update(raw).digest('hex');
}

function isWellFormed(raw: string | null): boolean {
  if (!raw) return false;
  // Expected: "wak_" + 48 hex chars = 52 chars total
  if (!raw.startsWith(PREFIX)) return false;
  const rest = raw.slice(PREFIX.length);
  if (rest.length !== 48) return false;
  return /^[a-f0-9]+$/.test(rest);
}

export async function authenticateApiKey(
  request: Request,
): Promise<ApiKeyAuthResult | null> {
  const header = request.headers.get('x-api-key')?.trim();
  if (!header) return null;

  if (!isWellFormed(header)) {
    console.warn('[api-key] malformed key format:', header.slice(0, 12));
    return null;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const keyHash = hashKey(header);

  const { data: row, error } = await supabase
    .from('api_keys')
    .select('id, account_id, user_id, scopes, revoked_at, expires_at')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (error || !row) {
    console.warn('[api-key] lookup failed or key not found');
    return null;
  }

  // Revoked?
  if (row.revoked_at) {
    console.warn('[api-key] revoked key used:', row.id);
    return null;
  }

  // Expired?
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    console.warn('[api-key] expired key used:', row.id);
    return null;
  }

  // Best-effort bump of last_used_at (fire-and-forget so latency is minimal)
  void supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', row.id)
    .then(({ error: updErr }) => {
      if (updErr) console.warn('[api-key] last_used_at update failed:', updErr.message);
    });

  return {
    accountId: row.account_id,
    userId: row.user_id,
    scopes: row.scopes ?? [],
    keyId: row.id,
  };
}

/**
 * Require an API key and optionally one or more scopes.
 *
 * Returns a NextResponse on auth failure (caller should `return` it).
 * Returns the ApiKeyAuthResult on success.
 */
export function requireApiKey(
  result: ApiKeyAuthResult | null,
  requiredScopes?: string[],
): ApiKeyAuthResult | NextResponse {
  if (!result) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid x-api-key header.' },
      { status: 401 },
    );
  }

  if (requiredScopes && requiredScopes.length > 0) {
    const missing = requiredScopes.filter((s) => !result.scopes.includes(s));
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Forbidden. Missing scopes: ${missing.join(', ')}`,
        },
        { status: 403 },
      );
    }
  }

  return result;
}

/**
 * Generate a new API key string.
 * Format: wak_<48 hex chars> — human-readable prefix, 192 bits of entropy.
 */
export function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${PREFIX}${hex}`;
}

/**
 * Build a Supabase admin client scoped to the resolved account.
 * Convenience for routes that need to do DB work after auth.
 */
export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
