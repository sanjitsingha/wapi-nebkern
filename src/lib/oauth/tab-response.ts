// ============================================================
// The other half of the tab contract (see tab.ts).
//
// An OAuth callback that ran in its own tab has nowhere useful to
// redirect to: the settings page is in the OPENER, still mounted, still
// holding its state. So instead of a 302 we render a one-shot page that
// hands the outcome back through postMessage and closes itself.
//
// Server-only: returns a NextResponse.
// ============================================================

import { NextResponse } from 'next/server';

import { OAUTH_MESSAGE_SOURCE } from './tab';

/**
 * Escape a JSON payload for embedding in an inline <script>.
 *
 * Two things break this pattern classically: `</script>` inside a string
 * literal closes the tag early, and U+2028 / U+2029 are legal in JSON
 * but were line terminators in JS source before ES2019.
 *
 * Rather than special-case those, everything outside printable ASCII
 * (plus `<`) becomes a \uXXXX escape. That covers both hazards and any
 * accented Page name or emoji-laden username along with them, and it
 * keeps the output — and this file — pure ASCII.
 */
function toScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(
    /[^\x20-\x7E]|</g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

/**
 * Report an OAuth outcome to the opener and close the tab.
 *
 * `params` is a free-form bag — each flow sends whatever its settings
 * panel needs (a page name, a username, an error string). Null and
 * undefined entries are dropped so the receiving side can treat every
 * present key as meaningful.
 *
 * The visible markup is a fallback, not decoration: if the tab can't
 * close itself (some browsers refuse for tabs they didn't open via
 * script) the user is left looking at this page, and it needs to say
 * something better than a blank screen.
 */
export function oauthTabResponse(
  params: Record<string, string | null | undefined>,
): NextResponse {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.length > 0) clean[key] = value;
  }

  const payload = toScriptJson({ source: OAUTH_MESSAGE_SOURCE, params: clean });
  const failed = Boolean(clean.error);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${failed ? 'Connection failed' : 'Connected'}</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#191826;background:#fff}
  .box{max-width:22rem;padding:2rem;text-align:center}
  p{margin:.5rem 0 0;color:#5b5b6b}
  @media (prefers-color-scheme:dark){body{background:#141419;color:#f4f4f6}p{color:#a1a1ad}}
</style>
</head>
<body>
  <div class="box">
    <strong>${failed ? 'Connection failed' : 'All set'}</strong>
    <p>You can close this tab and return to the app.</p>
  </div>
  <script>
    (function () {
      var payload = ${payload};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, window.location.origin);
        }
      } catch (e) {
        // Opener gone or navigated away - the fallback text stands in.
      }
      window.close();
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Carries the outcome of a one-time handshake — never reuse it.
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
