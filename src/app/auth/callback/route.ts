import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { OAUTH_NEXT_COOKIE, safeNextPath } from '@/lib/auth/oauth-next';

/**
 * OAuth (and email-confirmation) callback.
 *
 * The Google "Continue with Google" button starts a PKCE flow with
 * `redirectTo` pointing here. The provider sends the browser back with a
 * `?code=...`; we exchange it for a session (which sets the auth cookies via
 * the SSR client) and then forward the user on to their destination —
 * `/dashboard` by default, `/join/<token>` when the sign-in began from an
 * invite link, or back to settings after linking an identity.
 *
 * That destination arrives in the `wacrm-oauth-next` cookie rather than a
 * query param, because a query string on `redirectTo` has to be matched
 * by the Supabase Redirect URLs allow-list separately and silently drops
 * the user on the Site URL when it isn't — see lib/auth/oauth-next.ts.
 * `?next=` is still honoured for links already in flight (and for
 * anything hand-built against the old contract).
 *
 * On any failure we bounce to /login with an `error` the page can surface.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  const cookieStore = await cookies();
  const next =
    safeNextPath(searchParams.get('next')) ??
    safeNextPath(
      decodeURIComponent(cookieStore.get(OAUTH_NEXT_COOKIE)?.value ?? ''),
    ) ??
    '/dashboard';

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
      const target =
        isLocal || !forwardedHost
          ? `${origin}${next}`
          : `https://${forwardedHost}${next}`;

      const response = NextResponse.redirect(target);
      // Spent — drop it, so a later sign-in can't inherit this one's
      // destination.
      response.cookies.delete(OAUTH_NEXT_COOKIE);
      return response;
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('Could not sign in. Please try again.')}`,
  );
}
