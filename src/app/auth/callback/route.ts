import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * OAuth (and email-confirmation) callback.
 *
 * The Google "Continue with Google" button starts a PKCE flow with
 * `redirectTo` pointing here. The provider sends the browser back with a
 * `?code=...`; we exchange it for a session (which sets the auth cookies via
 * the SSR client) and then forward the user on to `next` — `/dashboard` by
 * default, or `/join/<token>` when the sign-in began from an invite link.
 *
 * On any failure we bounce to /login with an `error` the page can surface.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // `next` is where to land after a successful exchange. Only allow
  // same-site relative paths — never redirect to an attacker-supplied
  // absolute URL (open-redirect guard).
  const nextParam = searchParams.get('next') ?? '/dashboard';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//')
    ? nextParam
    : '/dashboard';

  // The provider can hand back its own error (e.g. the user cancelled the
  // consent screen). Surface it rather than silently retrying.
  const providerError =
    searchParams.get('error_description') ?? searchParams.get('error');
  if (providerError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(providerError)}`,
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Behind a proxy/load balancer the request host is the internal one;
      // honour the forwarded host so the redirect targets the public origin.
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocal = process.env.NODE_ENV === 'development';
      if (isLocal || !forwardedHost) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      return NextResponse.redirect(`https://${forwardedHost}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('Could not sign in. Please try again.')}`,
  );
}
