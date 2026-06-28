import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  authenticateApiKey,
  requireApiKey,
} from '@/lib/api-keys/auth';
import { buildAppointmentTemplateParams } from '@/lib/integrations/appointment-notification';
import { sanitizePhoneForMeta, isValidE164 } from '@/lib/whatsapp/phone-utils';
import { decrypt } from '@/lib/whatsapp/encryption';
import { sendTemplateMessage } from '@/lib/whatsapp/meta-api';
import { isMessageTemplate } from '@/lib/whatsapp/template-row-guard';

/**
 * POST /api/integrations/appointment-event
 *
 * Send a WhatsApp appointment notification to a patient.
 *
 * Auth: x-api-key header (per-account scoped API key from wacrm Settings)
 *
 * Body:
 *   {
 *     patient: { name: string, phone: string },
 *     appointment: { id, date, time, doctor_name, clinic_name },
 *     template: { name: string, language?: string },
 *     variable_order?: string[]
 *   }
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate via API key (server-to-server, no browser session)
    const apiAuth = await authenticateApiKey(request);
    const authResult = requireApiKey(apiAuth, ['send:messages']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const accountId = authResult.accountId;

    const body = await request.json();
    const { patient, appointment, template, variable_order } = body ?? {};

    const phone = patient?.phone;
    if (!phone) {
      return NextResponse.json(
        { error: 'patient.phone is required' },
        { status: 400 }
      );
    }

    // Use admin client for DB lookups (no session cookie in server-to-server)
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

    const sanitizedPhone = sanitizePhoneForMeta(phone);
    if (!isValidE164(sanitizedPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    const templateName =
      template?.name || template?.slug || template?.template_name;
    if (!templateName) {
      return NextResponse.json(
        { error: 'template.name is required' },
        { status: 400 }
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
        { error: 'Template row is malformed locally.' },
        { status: 500 }
      );
    }

    const params = buildAppointmentTemplateParams(
      { patient, appointment },
      Array.isArray(variable_order) ? variable_order : undefined
    );

    const accessToken = decrypt(config.access_token);
    const messageResult = await sendTemplateMessage({
      phoneNumberId: config.phone_number_id,
      accessToken,
      to: sanitizedPhone,
      templateName,
      language: template?.language || 'en_US',
      template: rawTemplateRow ?? undefined,
      params,
    });

    return NextResponse.json({
      success: true,
      message_id: messageResult.messageId,
      template_name: templateName,
      phone: sanitizedPhone,
    });
  } catch (error) {
    console.error('appointment-event integration error', error);
    return NextResponse.json(
      { error: 'Failed to send appointment notification' },
      { status: 500 }
    );
  }
}
