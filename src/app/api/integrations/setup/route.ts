import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
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

    const { data: rows, error } = await supabase
      .from('account_settings')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      config: rows ?? {
        appointment_notification_template: null,
        appointment_notification_enabled: false,
      },
    });
  } catch (error) {
    console.error('integration setup read error', error);
    return NextResponse.json(
      { error: 'Failed to load integration setup' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
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

    const body = await request.json();
    const nextConfig = {
      appointment_notification_template:
        body?.appointment_notification_template ?? null,
      appointment_notification_enabled: Boolean(
        body?.appointment_notification_enabled
      ),
      appointment_variable_order: body?.appointment_variable_order ?? [
        'patient_name',
        'patient_phone',
        'appointment_id',
        'appointment_date',
        'appointment_time',
        'doctor_name',
        'clinic_name',
      ],
    };

    const { data: existing } = await supabase
      .from('account_settings')
      .select('id')
      .eq('account_id', accountId)
      .maybeSingle();

    let result;
    if (existing?.id) {
      result = await supabase
        .from('account_settings')
        .update(nextConfig)
        .eq('id', existing.id)
        .select('*')
        .single();
    } else {
      result = await supabase
        .from('account_settings')
        .insert({ account_id: accountId, ...nextConfig })
        .select('*')
        .single();
    }

    if (result.error) throw result.error;

    return NextResponse.json({ config: result.data });
  } catch (error) {
    console.error('integration setup save error', error);
    return NextResponse.json(
      { error: 'Failed to save integration setup' },
      { status: 500 }
    );
  }
}
