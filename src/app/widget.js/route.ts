import { widgetConfigFromRow } from '@/lib/widget/config';
import {
  buildDisabledScript,
  buildWidgetScript,
  widgetHref,
} from '@/lib/widget/runtime';
import { supabaseAdmin } from '@/lib/widget/admin-client';

/**
 * GET /widget.js?id=<public_key>
 *
 * The public loader. Anonymous, cross-origin, and called from pages we
 * don't control — so a few rules apply that don't apply anywhere else in
 * this app:
 *
 *   - It NEVER returns an error status. Every failure (unknown key,
 *     widget switched off, no number connected, database down) serves a
 *     valid no-op script with 200. A snippet sitting in someone's
 *     footer must degrade to nothing rather than to a red console error
 *     the site owner has to explain to their developer.
 *   - It leaks nothing about why. "Unknown key" and "disabled" are
 *     indistinguishable from outside, so the endpoint can't be used to
 *     probe which keys exist.
 *   - Responses are cacheable. This is a hot path on third-party sites;
 *     five minutes of CDN caching turns a per-pageview database read
 *     into a per-five-minutes one. The cost is that a settings change
 *     takes up to five minutes to reach every visitor, which is the
 *     right trade for a chat bubble's colour.
 */

// The query string and the database read both make this request-time
// work; nothing here can be prerendered.
export const dynamic = 'force-dynamic';

const CACHE_SECONDS = 300;
const FAILURE_CACHE_SECONDS = 30;

function scriptResponse(body: string, cacheable: boolean): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // `max-age=0, s-maxage=N` on purpose: the visitor's browser
      // revalidates every time (so a settings change reaches returning
      // visitors promptly) while the CDN absorbs the load. Matches the
      // convention in next.config.ts, which exempts this path so these
      // values actually survive.
      'Cache-Control': cacheable
        ? `public, max-age=0, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400`
        : // A transient database failure gets a short edge cache and no
          // stale-while-revalidate: enough to blunt a thundering herd
          // during an outage, short enough that widgets come back
          // within half a minute of the database recovering.
          `public, max-age=0, s-maxage=${FAILURE_CACHE_SECONDS}`,
      // Not required for a classic <script src> tag, but makes the file
      // usable via fetch()/import() too, and costs nothing.
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const key = new URL(request.url).searchParams.get('id');

  if (!key || key.length > 64) {
    return scriptResponse(buildDisabledScript('no widget id'), true);
  }

  let row: Record<string, unknown> | null = null;
  try {
    const { data, error } = await supabaseAdmin()
      .from('whatsapp_widgets')
      .select(
        'enabled, phone, prefilled_message, business_name, tagline, greeting, brand_color, placement, auto_open_delay_seconds, show_on_mobile, show_on_desktop',
      )
      .eq('public_key', key)
      .maybeSingle();

    if (error) throw error;
    row = data;
  } catch (err) {
    console.error('[widget.js] lookup failed:', err);
    return scriptResponse(buildDisabledScript('unavailable'), false);
  }

  if (!row) {
    return scriptResponse(buildDisabledScript('not found'), true);
  }

  const config = widgetConfigFromRow(row);
  if (!config.enabled) {
    return scriptResponse(buildDisabledScript('not found'), true);
  }

  // No connected number snapshotted yet — there is nowhere to send the
  // visitor, so rendering a bubble would be worse than rendering none.
  const href = widgetHref(config);
  if (!href) {
    return scriptResponse(buildDisabledScript('not configured'), true);
  }

  return scriptResponse(buildWidgetScript({ config, href }), true);
}
