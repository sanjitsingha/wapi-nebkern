import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// No 404 UI: anything unroutable bounces to wherever the visitor
// belongs — the app if they're signed in, the landing page if they're
// not. The root not-found catches BOTH cases Next has (see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md):
// a `notFound()` thrown inside a segment, and any URL that matches no
// route at all.
//
// `getSession` rather than `getUser` on purpose. getUser() is a network
// round trip to Supabase Auth, and 404s are precisely the traffic bots
// generate in bulk — a crawler walking dead URLs would bill us an auth
// call per miss. getSession() reads the cookie locally, and a forged one
// buys nothing: /dashboard is gated by the proxy/middleware, which does
// verify properly and will bounce an invalid session to /login. The
// worst case is one extra hop, not a leak.
export default async function NotFound() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  redirect(session ? '/dashboard' : '/');
}
