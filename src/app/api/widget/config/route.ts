import { NextResponse } from 'next/server';

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account';
import {
  DEFAULT_WIDGET_CONFIG,
  buildEmbedSnippet,
  generatePublicKey,
  sanitizeWidgetConfig,
  widgetConfigFromRow,
  widgetConfigToRow,
  type WidgetConfig,
} from '@/lib/widget/config';
import { widgetHref } from '@/lib/widget/runtime';
import { verifyPhoneNumber } from '@/lib/whatsapp/meta-api';
import { decrypt } from '@/lib/whatsapp/encryption';

const SELECT =
  'public_key, enabled, phone, prefilled_message, business_name, tagline, greeting, brand_color, placement, auto_open_delay_seconds, show_on_mobile, show_on_desktop';

/**
 * The origin the embed snippet should point at.
 *
 * Derived from the request rather than a hardcoded env var so the
 * snippet is correct on localhost, on a preview deploy, and in
 * production without any extra configuration. `NEXT_PUBLIC_APP_URL`
 * wins when set, for deployments behind a proxy where the request host
 * isn't the public one.
 */
function resolveOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, '');
  return new URL(request.url).origin;
}

/**
 * GET /api/widget/config
 *
 * Returns the account's widget config, its public key, and the ready-to
 * paste snippet. Any member can read it; only admins can save.
 *
 * Returns the defaults (with `provisioned: false`) when no row exists
 * yet rather than creating one — a GET shouldn't write, and the row gets
 * created on first save.
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await getCurrentAccount();

    const { data, error } = await supabase
      .from('whatsapp_widgets')
      .select(SELECT)
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) {
      console.error('[widget/config GET] fetch failed:', error);
      return NextResponse.json(
        { error: 'Failed to load widget settings' },
        { status: 500 },
      );
    }

    const connectedPhone = await resolveConnectedPhone(supabase, accountId);

    if (!data) {
      return NextResponse.json({
        provisioned: false,
        config: { ...DEFAULT_WIDGET_CONFIG, phone: connectedPhone },
        publicKey: null,
        snippet: null,
        connectedPhone,
      });
    }

    const config = widgetConfigFromRow(data);
    return NextResponse.json({
      provisioned: true,
      config,
      publicKey: data.public_key,
      snippet: buildEmbedSnippet(resolveOrigin(request), data.public_key),
      connectedPhone,
      // Lets the UI warn that the saved snapshot has drifted from the
      // number currently connected (e.g. they reconnected a new one).
      stalePhone: !!connectedPhone && config.phone !== connectedPhone,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * PUT /api/widget/config
 *
 * Saves the config. Admin-only, matching the RLS policy.
 *
 * The phone number is NOT taken from the request body — it's resolved
 * server-side from the account's connected WhatsApp config. The widget
 * points at the account's own number by definition; accepting one from
 * the client would let any admin publish a bubble that funnels their
 * visitors to an arbitrary number.
 */
export async function PUT(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin');

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from('whatsapp_widgets')
      .select('id, public_key, phone')
      .eq('account_id', accountId)
      .maybeSingle();

    if (existingError) {
      console.error('[widget/config PUT] lookup failed:', existingError);
      return NextResponse.json(
        { error: 'Failed to save widget settings' },
        { status: 500 },
      );
    }

    // Prefer the live number, but fall back to the one already
    // snapshotted on the row. Otherwise a Meta outage would turn an
    // ordinary "change the greeting" save into a 409, or worse, blank
    // the number on a widget that is live on a customer's site.
    const connectedPhone =
      (await resolveConnectedPhone(supabase, accountId)) ||
      String(existing?.phone ?? '');

    if (!connectedPhone) {
      return NextResponse.json(
        {
          error:
            'Connect a WhatsApp Business number before publishing the widget.',
        },
        { status: 409 },
      );
    }

    const config: WidgetConfig = sanitizeWidgetConfig({
      ...(body as Record<string, unknown>),
      phone: connectedPhone,
    });

    // Should be unreachable given the check above, but a sanitized
    // config that can't produce a link would publish a dead bubble.
    if (!widgetHref(config)) {
      return NextResponse.json(
        { error: 'The connected number is not a valid WhatsApp number.' },
        { status: 409 },
      );
    }

    const row = widgetConfigToRow(config);
    // Preserved across saves: rotating it on every save would silently
    // break every site the snippet is already pasted into.
    const publicKey = existing?.public_key ?? generatePublicKey();

    const { error: writeError } = existing
      ? await supabase
          .from('whatsapp_widgets')
          .update(row)
          .eq('account_id', accountId)
      : await supabase.from('whatsapp_widgets').insert({
          account_id: accountId,
          created_by: userId,
          public_key: publicKey,
          ...row,
        });

    if (writeError) {
      console.error('[widget/config PUT] write failed:', writeError);
      return NextResponse.json(
        { error: 'Failed to save widget settings' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      config,
      publicKey,
      snippet: buildEmbedSnippet(resolveOrigin(request), publicKey),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * The account's connected WhatsApp number, digits only. Empty string
 * when WhatsApp isn't connected or Meta can't be reached.
 *
 * The number is not stored locally — `whatsapp_config` keeps only the
 * phone_number_id and an encrypted token — so the only way to get it is
 * to ask Meta, which is what the existing /api/whatsapp/config GET does
 * too. That's acceptable here because this runs on settings load and
 * save only: the resolved number is snapshotted onto the widget row, so
 * the public /widget.js path never touches Meta.
 */
async function resolveConnectedPhone(
  supabase: Awaited<ReturnType<typeof getCurrentAccount>>['supabase'],
  accountId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('whatsapp_config')
    .select('phone_number_id, access_token, status')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error || !data || data.status !== 'connected') return '';

  try {
    const info = await verifyPhoneNumber({
      phoneNumberId: data.phone_number_id,
      accessToken: decrypt(data.access_token),
    });
    return String(info.display_phone_number ?? '').replace(/\D/g, '');
  } catch (err) {
    // A corrupted token or a Meta outage shouldn't 500 the settings
    // page. Callers treat "" as "not connected"; PUT additionally falls
    // back to the number already snapshotted on the row, so an outage
    // can't wipe a working widget.
    console.error('[widget/config] could not resolve connected number:', err);
    return '';
  }
}
