// ============================================================
// The origin the browser actually used to reach us.
//
// Not `new URL(request.url).origin`. In production `next start` sits
// behind nginx, and Next builds `request.url` from its own listen
// address: every request there reads as https://localhost:3000. It
// honours X-Forwarded-Proto but ignores both the Host nginx passes on
// and X-Forwarded-Host. Anything built from that origin — an OAuth
// redirect_uri, a 302 back to Settings, an embed snippet — sends the
// browser to localhost. That is how the Facebook connect landed on
// https://localhost:3000/api/meta/oauth/callback after consent.
//
// The request's own host, not NEXT_PUBLIC_SITE_URL: an OAuth round
// trip is pinned to the host that set its state cookie, so the callback
// has to come back to exactly where the flow started — the live site in
// production, localhost on a dev server.
// ============================================================

/** Hostname or IP, optional port. Anything else is not a Host header. */
const HOST_RE = /^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(:\d{1,5})?$/i;

function firstValue(header: string | null): string | undefined {
  return header?.split(',')[0]?.trim() || undefined;
}

export function publicOrigin(request: Request): string {
  const url = new URL(request.url);

  const host =
    firstValue(request.headers.get('x-forwarded-host')) ??
    firstValue(request.headers.get('host'));
  if (!host || !HOST_RE.test(host)) return url.origin;

  const forwardedProto = firstValue(request.headers.get('x-forwarded-proto'));
  const proto =
    forwardedProto === 'https' || forwardedProto === 'http'
      ? forwardedProto
      : url.protocol.replace(':', '');

  return `${proto}://${host.toLowerCase()}`;
}
