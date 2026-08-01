import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * POST /api/auth/check-email  { email }
 *
 * Answers "can I register this address?" before the signup form
 * submits, and — when the answer is no — says *why* so the UI can send
 * the user down the right path instead of a dead end.
 *
 *   { available: true }
 *   { available: false, provider: 'google',   message }
 *   { available: false, provider: 'password', message }
 *
 * This exists because GoTrue won't tell the browser. signUp() on an
 * address that already exists returns a decoy user with an empty
 * identities array and NO error, so an unguarded form cheerfully shows
 * "check your email" for an account it did not create. The Google case
 * is worse: someone who registered with Google and later tries
 * email+password gets that same silent nothing.
 *
 * Enumeration trade-off, stated plainly: a distinguishable "taken"
 * response is by definition an oracle for whether an address has an
 * account here. That is the deliberate call — the alternative is the
 * dead end above. It is kept as narrow as possible: POST only (no
 * crawlable GET), one address per call, a per-IP throttle below, and
 * the underlying DB function is service-role only so the anon key
 * can't be pointed at it directly. The signup path still re-checks
 * after signUp() regardless, because this answer can go stale between
 * the keystroke and the submit.
 */

// Lazy service-role client — auth_email_status (migration 073) is
// granted to service_role alone.
let _adminClient: SupabaseClient | null = null;
function supabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _adminClient;
}

// ---- throttle -----------------------------------------------
// Best-effort, in-process: it is per server instance, so N instances
// allow N times the budget and a deploy resets the counters. That is
// enough to stop a single client dictionary-walking the endpoint from
// one box, which is what it is for. Anything stronger belongs at the
// edge (WAF / rate-limiting proxy), not in a Node map.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, { count: number; resetAt: number }>();

function throttled(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    // Opportunistic sweep so the map can't grow without bound across a
    // long-lived process; cheap because it only runs on a fresh window.
    if (hits.size > 5_000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

// Deliberately loose — this is a shape check to avoid pointless DB
// round trips, not an RFC 5322 validator. The <input type="email"> and
// GoTrue both have their own opinions; ours only needs to reject
// obvious junk.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (throttled(ip)) {
      return NextResponse.json(
        { error: 'Too many checks. Please wait a moment.' },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null);
    const raw = typeof body?.email === 'string' ? body.email.trim() : '';
    if (!raw || !EMAIL_SHAPE.test(raw)) {
      return NextResponse.json(
        { error: 'Enter a valid email address.' },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin().rpc('auth_email_status', {
      p_email: raw,
    });

    if (error) {
      // Fail OPEN. A lookup outage must not block registration — the
      // signup path re-checks after signUp() and GoTrue is the real
      // authority on uniqueness either way.
      console.error('[check-email] lookup failed:', error);
      return NextResponse.json({ available: true, degraded: true });
    }

    // A set-returning function comes back as an array of rows.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.user_exists) {
      return NextResponse.json({ available: true });
    }

    const providers: string[] = row.providers ?? [];
    // 'email' is GoTrue's name for a password identity. Its absence
    // means the account can only be entered through its OAuth provider.
    const hasPassword = providers.includes('email');
    const google = providers.includes('google');

    if (!hasPassword && google) {
      return NextResponse.json({
        available: false,
        provider: 'google',
        message:
          'This email is already registered with Google. Use “Continue with Google” to sign in.',
      });
    }

    return NextResponse.json({
      available: false,
      provider: 'password',
      message: 'An account with this email already exists. Sign in instead.',
    });
  } catch (err) {
    console.error('[check-email] unexpected error:', err);
    // Same fail-open reasoning as above.
    return NextResponse.json({ available: true, degraded: true });
  }
}
