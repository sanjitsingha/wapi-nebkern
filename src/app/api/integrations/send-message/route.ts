import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  authenticateApiKey,
  requireApiKey,
} from '@/lib/api-keys/auth';
import { sanitizePhoneForMeta, isValidE164 } from '@/lib/whatsapp/phone-utils';
import { decrypt } from '@/lib/whatsapp/encryption';
import { sendTemplateMessage } from '@/lib/whatsapp/meta-api';
import { isMessageTemplate } from '@/lib/whatsapp/template-row-guard';
import type { SendTimeParams } from '@/lib/whatsapp/template-send-builder';

/**
 * POST /api/integrations/send-message
 *
 * Generic server-to-server endpoint for sending a WhatsApp template message
 * to any recipient. No appointment-specific fields — external software sends
 * whatever template + variables it needs.
 *
 * Auth: x-api-key header (per-account scoped API key from wacrm Settings)
 *
 * Body (simple — body variables only):
 *   {
 *     "to": "+15551234567",
 *     "template": { "name": "hello_world", "language": "en_US" },
 *     "params": ["John", "Monday"]
 *   }
 *
 * Body (advanced — headers, buttons, media):
 *   {
 *     "to": "+15551234567",
 *     "template": { "name": "hello_world", "language": "en_US" },
 *     "messageParams": {
 *       "body": ["John", "Monday"],
 *       "headerText": "Reminder",
 *       "headerMediaUrl": "https://example.com/image.jpg",
 *       "buttonParams": { "0": "https://example.com/confirm" }
 *     }
 *   }
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate via API key
    const apiAuth = await authenticateApiKey(request);
    const authResult = requireApiKey(apiAuth, ['send:messages']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const accountId = authResult.accountId;

    const body = await request.json();
    const { to, template, params, messageParams } = body ?? {};

    // 2. Validate phone
    if (!to || typeof to !== 'string') {
      return NextResponse.json(
        { error: '`to` (phone number) is required' },
        { status: 400 }
      );
    }

    const sanitizedPhone = sanitizePhoneForMeta(to);
    if (!isValidE164(sanitizedPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Use E.164 (e.g. +15551234567).' },
        { status: 400 }
      );
    }

    // 3. Validate template
    const templateName = template?.name;
    if (!templateName || typeof templateName !== 'string') {
      return NextResponse.json(
        { error: '`template.name` is required' },
        { status: 400 }
      );
    }

    const language = template?.language || 'en_US';

    // 4. Load WhatsApp config for this account
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('account_id', accountId)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { error: 'WhatsApp is not configured for this account.' },
        { status: 400 }
      );
    }

    // 5. Load template row (for advanced components: headers, buttons, media)
    const { data: rawTemplateRow } = await supabase
      .from('message_templates')
      .select('*')
      .eq('account_id', accountId)
      .eq('name', templateName)
      .maybeSingle();

    if (rawTemplateRow && !isMessageTemplate(rawTemplateRow)) {
      return NextResponse.json(
        { error: 'Template row is malformed locally. Run "Sync from Meta" in Settings.' },
        { status: 500 }
      );
    }

    const templateRow = rawTemplateRow ?? undefined;

    // 6. Build send arguments
    const accessToken = decrypt(config.access_token);

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
      accessToken,
      to: sanitizedPhone,
      templateName,
      language,
      template: templateRow,
    };

    // Prefer structured messageParams if provided; fall back to flat params array
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

    const messageResult = await sendTemplateMessage(sendArgs);

    return NextResponse.json({
      success: true,
      message_id: messageResult.messageId,
      template_name: templateName,
      phone: sanitizedPhone,
    });
  } catch (error) {
    console.error('[send-message] integration error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
