import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rescue a stranded OAuth code.
  //
  // Supabase only honours a `redirectTo` that matches the project's
  // Redirect URLs allow-list; on a miss it drops the browser on the Site
  // URL instead — typically `/`, the marketing homepage — with an
  // unspent `?code=` in the query. The user has just cleared Google
  // consent and lands on a logged-out landing page for their trouble.
  //
  // Rather than depend on a dashboard setting being right, finish the
  // job: hand any stray code to /auth/callback, which exchanges it and
  // forwards on to wherever the flow was headed. Scoped to signed-out
  // browsers on non-API pages — /api/* has its own OAuth callbacks for
  // Instagram and Messenger that take a `code` of their own, and
  // /auth/callback is excluded so this can't loop.
  const strayCode = request.nextUrl.searchParams.get('code');
  if (
    !user &&
    strayCode &&
    !request.nextUrl.pathname.startsWith('/api/') &&
    !request.nextUrl.pathname.startsWith('/auth/')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/callback';
    return NextResponse.redirect(url);
  }

  // Auth pages - redirect to dashboard if already logged in.
  // Exception: when an invite token is in the query string we
  // send the already-signed-in user to /join/<token> instead so
  // they can accept the invitation in one click. Without this,
  // a forwarded invite link to someone who's already signed in
  // would silently drop them on /dashboard.
  if (
    user &&
    (request.nextUrl.pathname === '/login' ||
      request.nextUrl.pathname === '/signup' ||
      request.nextUrl.pathname === '/forgot-password')
  ) {
    const url = request.nextUrl.clone();
    const inviteToken = request.nextUrl.searchParams.get('invite');
    if (
      inviteToken &&
      (request.nextUrl.pathname === '/login' ||
        request.nextUrl.pathname === '/signup')
    ) {
      url.pathname = `/join/${encodeURIComponent(inviteToken)}`;
      url.search = '';
    } else {
      url.pathname = '/dashboard';
      url.search = '';
    }
    return NextResponse.redirect(url);
  }

  // Protected pages - redirect to login if not authenticated. Covers the
  // whole in-app surface (the (dashboard) route group) plus /onboarding
  // and /invoices, so an unauthenticated visitor to any of them lands on
  // /login rather than a half-rendered shell.
  const protectedPaths = [
    '/dashboard',
    '/inbox',
    '/contacts',
    '/pipelines',
    '/campaigns',
    '/automations',
    '/settings',
    '/invoices',
    '/agents',
    '/broadcasts',
    '/flows',
    '/forms',
    '/lists',
    '/media',
    '/segments',
    '/templates',
    '/onboarding',
    '/welcome',
  ];
  const onProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );
  if (!user && onProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Two one-time gates, in order: WHO ARE YOU (/welcome), then WHICH
  // PLAN (/onboarding), then the app.
  //
  //   profiles.profile_completed_at NULL (migration 073)
  //     -> an OAuth signup we have no org / attribution for. Password
  //        signups collect the same details on the signup form, so the
  //        trigger stamps them complete and they skip this entirely.
  //        Cleared by POST /api/account/complete-profile.
  //
  //   accounts.onboarded_at NULL (migration 070)
  //     -> the owner hasn't started the 14-day trial or subscribed yet.
  //        Cleared by the start-trial route or the Razorpay verify route.
  //
  // One lookup serves both, and only on the in-app surface plus the two
  // gate pages themselves.
  const onWelcome = request.nextUrl.pathname === '/welcome';
  const onOnboarding = request.nextUrl.pathname === '/onboarding';
  if (user && onProtected) {
    // Both flags normally ride along on the user object we already
    // fetched — migration 079 mirrors them into app_metadata and keeps
    // them in step via triggers, so the common case costs no query at
    // all. This used to run a profiles + accounts join on EVERY
    // protected navigation to read two timestamps that, once set, never
    // unset.
    //
    // app_metadata rather than a signed cookie on purpose: this gate
    // stands in front of the paywall, and a cookie is something the
    // browser can forge. getUser() reads the live auth row, not the
    // JWT's copy, so paying for a plan opens the gate on the very next
    // request rather than after a token refresh.
    const meta = user.app_metadata as Record<string, unknown> | undefined;
    let profileComplete: boolean;
    let onboarded: boolean;

    if (
      typeof meta?.profile_complete === 'boolean' &&
      typeof meta?.onboarded === 'boolean'
    ) {
      profileComplete = meta.profile_complete;
      onboarded = meta.onboarded;
    } else {
      // Fallback for sessions predating 079, and for the window during
      // signup before the trigger has stamped the row.
      const { data: prof } = await supabase
        .from('profiles')
        .select('profile_completed_at, account:accounts!inner(onboarded_at)')
        .eq('user_id', user.id)
        .maybeSingle();
      // Supabase surfaces an !inner join as an object or a single-element
      // array depending on inferred cardinality — normalise before reading.
      const accountRow = Array.isArray(prof?.account)
        ? prof?.account[0]
        : prof?.account;
      // Fail OPEN on both: a missing profile row, a pre-070/073 fork
      // without the column, or a transient read error must never trap a
      // user behind a gate they have no way to clear.
      onboarded = accountRow ? accountRow.onboarded_at != null : true;
      profileComplete = prof ? prof.profile_completed_at != null : true;
    }

    const redirectTo = (pathname: string) => {
      const url = request.nextUrl.clone();
      url.pathname = pathname;
      url.search = '';
      return NextResponse.redirect(url);
    };

    if (!profileComplete) {
      // Details outrank the plan step — someone with both pending goes
      // to /welcome first, including when they land on /onboarding.
      if (!onWelcome) return redirectTo('/welcome');
    } else {
      // Done with it; don't let them sit on the gate. Hand them
      // straight to the next one so this isn't a double redirect.
      if (onWelcome) return redirectTo(onboarded ? '/dashboard' : '/onboarding');
      if (!onboarded && !onOnboarding) return redirectTo('/onboarding');
      if (onboarded && onOnboarding) return redirectTo('/dashboard');
    }
  }

  // The `/api/whatsapp/*` 401 guard that used to live here is gone, and
  // deliberately so: this middleware no longer runs on /api at all (see
  // the matcher). It was never load-bearing — every route under
  // /api/whatsapp authenticates itself, either through
  // getCurrentAccount / requireRole or its own `auth.getUser()` + 401,
  // and /api/whatsapp/webhook verifies Meta's HMAC signature instead.
  // The guard was a second, redundant auth round trip on every call.

  return supabaseResponse;
}

export const config = {
  matcher: [
    // What runs through here costs a `supabase.auth.getUser()` — a
    // NETWORK call to Supabase Auth, not a local token decode — so the
    // matcher is an exclusion list of everything that doesn't need one.
    //
    //   _next/static, _next/image, favicon, image files
    //     Static assets. No session, nothing to refresh.
    //
    //   widget.js
    //     The public chat-widget loader, fetched by anonymous visitors
    //     on customers' own websites. There is never a session, and an
    //     auth round trip on every third-party pageview would slow it
    //     down and break it whenever Supabase is unreachable.
    //
    //   api
    //     Every API route authenticates itself (getCurrentAccount /
    //     requireRole / its own getUser, or a signature check on the
    //     webhooks). Running auth here as well meant each API call paid
    //     for it twice — on the notifications poll alone that was ~80
    //     wasted auth calls an hour per open tab.
    //
    //   the public marketing surface
    //     Anonymous pages: landing, pricing, blog, docs, contact and the
    //     legal documents. None of them read the session, and the legal
    //     ones are hit by payment-gateway and Meta reviewers.
    '/((?!_next/static|_next/image|favicon\\.ico|widget\\.js|api/|docs|blog|pricing|contact|autopilot|privacy|terms|cookies|refunds|acceptable-use|whatsapp-messaging-policy|whatsapp-marketing-policy|dpa|security|subprocessors|data-retention|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
