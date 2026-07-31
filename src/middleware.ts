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
    '/qr-code',
    '/segments',
    '/templates',
    '/onboarding',
  ];
  const onProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );
  if (!user && onProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Onboarding gate — a brand-new account owner must complete the
  // one-time plan-selection step (start the 14-day trial or subscribe)
  // before reaching the app. The signup trigger leaves accounts.onboarded_at
  // NULL (migration 070); it's stamped once the choice is made (the
  // start-trial route or the Razorpay verify route). The extra lookup only
  // runs on the in-app surface + the onboarding page itself.
  const onOnboarding = request.nextUrl.pathname === '/onboarding';
  if (user && onProtected) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('account:accounts!inner(onboarded_at)')
      .eq('user_id', user.id)
      .maybeSingle();
    // Supabase surfaces an !inner join as an object or a single-element
    // array depending on inferred cardinality — normalise before reading.
    const accountRow = Array.isArray(prof?.account)
      ? prof?.account[0]
      : prof?.account;
    // Fail OPEN: a missing profile row, a pre-070 fork without the column,
    // or a transient read error must never trap a user behind the gate.
    const onboarded = accountRow ? accountRow.onboarded_at != null : true;

    if (!onboarded && !onOnboarding) {
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding';
      url.search = '';
      return NextResponse.redirect(url);
    }
    // Already chosen — don't let them sit on the gate; send them in.
    if (onboarded && onOnboarding) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  // API routes that need auth (not webhooks)
  if (
    !user &&
    request.nextUrl.pathname.startsWith('/api/whatsapp/') &&
    !request.nextUrl.pathname.includes('/webhook')
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // `widget.js` is excluded deliberately. It's the public chat-widget
    // loader, fetched by anonymous visitors on customers' own websites:
    // there is never a session to refresh, and running the Supabase
    // auth round trip on every third-party pageview would both slow the
    // widget down and make it fail whenever Supabase is unreachable.
    '/((?!_next/static|_next/image|favicon.ico|widget\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
