import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildAppointmentTemplateParams } from '@/lib/integrations/appointment-notification';
import { sanitizePhoneForMeta, isValidE164 } from '@/lib/whatsapp/phone-utils';
import { decrypt } from '@/lib/whatsapp/encryption';
import { sendTemplateMessage } from '@/lib/whatsapp/meta-api';
import { isMessageTemplate } from '@/lib/whatsapp/template-row-guard';

function getHeaderApiKey(request: Request) {
  const header = request.headers.get('x-wacrm-api-key');
  return header?.trim();
}

export async function POST(request: Request) {
  try {
    const apiKey = getHeaderApiKey(request);
    const expectedApiKey = process.env.WACRM_INTEGRATION_API_KEY?.trim();

    if (!expectedApiKey || !apiKey || apiKey !== expectedApiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { organization_id, patient, appointment, template, variable_order } =
      body ?? {};

    if (!organization_id) {
      return NextResponse.json(
        { error: 'organization_id is required' },
        { status: 400 }
      );
    }

    const phone = patient?.phone;
    if (!phone) {
      return NextResponse.json(
        { error: 'patient.phone is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const accountId = profile?.account_id as string | undefined;
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 }
      );
    }

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
      template?.slug || template?.name || template?.template_name;
    if (!templateName) {
      return NextResponse.json(
        { error: 'template slug/name is required' },
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
