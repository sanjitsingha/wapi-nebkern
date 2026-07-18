import { NextResponse } from 'next/server';
import { authenticateApiKey, requireApiKey } from '@/lib/api-keys/auth';
import { supabaseAdmin } from '@/lib/webhooks/admin-client';
import { sanitizePhoneForMeta, isValidE164 } from '@/lib/whatsapp/phone-utils';
import { decrypt } from '@/lib/whatsapp/encryption';
import { sendTemplateMessage } from '@/lib/whatsapp/meta-api';
import { isMessageTemplate } from '@/lib/whatsapp/template-row-guard';
import type { SendTimeParams } from '@/lib/whatsapp/template-send-builder';

/**
 * POST /api/v1/messages
 *
 * Send a WhatsApp template message to any recipient — the "action" side
 * for automation platforms (Zapier/Make/n8n) and custom backends.
 *
 * Auth: x-api-key with the `send:messages` scope.
 *
 * Body (simple — body variables only):
 *   { "to": "+15551234567",
 *     "template": { "name": "hello_world", "language": "en_US" },
 *     "params": ["John", "Monday"] }
 *
 * Body (advanced — headers, buttons, media):
 *   { "to": "+15551234567",
 *     "template": { "name": "hello_world", "language": "en_US" },
 *     "messageParams": {
 *       "body": ["John", "Monday"],
 *       "headerText": "Reminder",
 *       "headerMediaUrl": "https://example.com/image.jpg",
 *       "buttonParams": { "0": "https://example.com/confirm" } } }
 */
export async function POST(request: Request) {
  try {
    const apiAuth = await authenticateApiKey(request);
    const auth = requireApiKey(apiAuth, ['send:messages']);
    if (auth instanceof NextResponse) return auth;
    const { accountId } = auth;

    const body = await request.json().catch(() => null);
    const { to, template, params, messageParams } = body ?? {};

    if (!to || typeof to !== 'string') {
      return NextResponse.json({ error: '`to` (phone number) is required' }, { status: 400 });
    }
    const sanitizedPhone = sanitizePhoneForMeta(to);
    if (!isValidE164(sanitizedPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number. Use E.164 (e.g. +15551234567).' },
        { status: 400 },
      );
    }

    const templateName = template?.name;
    if (!templateName || typeof templateName !== 'string') {
      return NextResponse.json({ error: '`template.name` is required' }, { status: 400 });
    }
    const language = template?.language || 'en_US';

    const supabase = supabaseAdmin();

    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('account_id', accountId)
      .single();
    if (!config) {
      return NextResponse.json(
        { error: 'WhatsApp is not configured for this account.' },
        { status: 400 },
      );
    }

    const { data: rawTemplateRow } = await supabase
      .from('message_templates')
      .select('*')
      .eq('account_id', accountId)
      .eq('name', templateName)
      .maybeSingle();
    if (rawTemplateRow && !isMessageTemplate(rawTemplateRow)) {
      return NextResponse.json(
        { error: 'Template row is malformed locally. Run "Sync from Meta" in Settings.' },
        { status: 500 },
      );
    }

    const sendArgs: {
      phoneNumberId: string;
      accessToken: string;
      to: string;
      templateName: string;
      language: string;
      template?: import('@/types').MessageTemplate;
      params?: string[];
      messageParams?: SendTimeParams;
    } = {
      phoneNumberId: config.phone_number_id,
      accessToken: decrypt(config.access_token),
      to: sanitizedPhone,
      templateName,
      language,
      template: rawTemplateRow ?? undefined,
    };

    if (messageParams && typeof messageParams === 'object') {
      const mp: SendTimeParams = {};
      if (Array.isArray(messageParams.body)) mp.body = messageParams.body;
      if (typeof messageParams.headerText === 'string') mp.headerText = messageParams.headerText;
      if (typeof messageParams.headerMediaUrl === 'string') mp.headerMediaUrl = messageParams.headerMediaUrl;
      if (typeof messageParams.headerMediaId === 'string') mp.headerMediaId = messageParams.headerMediaId;
      if (messageParams.buttonParams && typeof messageParams.buttonParams === 'object') {
        mp.buttonParams = messageParams.buttonParams as Record<number, string>;
      }
      sendArgs.messageParams = mp;
    } else if (Array.isArray(params)) {
      sendArgs.params = params.map((p) => String(p));
    }

    const result = await sendTemplateMessage(sendArgs);

    return NextResponse.json({
      success: true,
      message_id: result.messageId,
      template_name: templateName,
      phone: sanitizedPhone,
    });
  } catch (err) {
    console.error('[v1/messages] error:', err);
    // Surface the real reason. sendTemplateMessage (via throwMetaError)
    // produces an actionable message — which template field Meta rejected,
    // "Recipient phone number not in allowed list", an expired token, etc.
    // A caller on Zapier/Make only ever sees this string, so hiding it
    // behind a generic "Failed to send message" makes the send undebuggable.
    const detail = err instanceof Error ? err.message : 'Failed to send message';
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
