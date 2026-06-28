import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateApiKey, requireApiKey } from '@/lib/api-keys/auth';
import { buildHandshakePayload } from '@/lib/integrations/handshake';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let accountId: string | undefined;

    // Try API key auth first (server-to-server)
    const apiAuth = await authenticateApiKey(request);
    const apiKeyResult = requireApiKey(apiAuth);
    if (apiKeyResult instanceof NextResponse) {
      // Fall back to Supabase session auth
      const supabase = await createServerClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized. Sign in or provide a valid x-api-key header.' },
          { status: 401 }
        );
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('account_id')
        .eq('user_id', user.id)
        .maybeSingle();

      accountId = profile?.account_id as string | undefined;
      if (!accountId) {
        return NextResponse.json(
          { error: 'Your profile is not linked to an account.' },
          { status: 403 }
        );
      }
    } else {
      accountId = apiKeyResult.accountId;
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: configRow } = await supabase
      .from('account_settings')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    const payload = buildHandshakePayload(
      {
        organization_id: body?.organization_id,
        crm_name: body?.crm_name,
        crm_url: body?.crm_url,
      },
      {
        appointment_notification_template:
          configRow?.appointment_notification_template ?? null,
        appointment_notification_enabled: Boolean(
          configRow?.appointment_notification_enabled
        ),
        appointment_variable_order: configRow?.appointment_variable_order ?? [],
      }
    );

    // Override the hardcoded endpoint to the new generic one
    return NextResponse.json({
      ...payload,
      endpoint: '/api/integrations/send-message',
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'organization_id is required'
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('crm handshake error', error);
    return NextResponse.json(
      { error: 'Failed to build CRM handshake payload' },
      { status: 500 }
    );
  }
}
