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

    const { data: templates, error } = await supabase
      .from('message_templates')
      .select('id,name,language,category,status,body_text')
      .eq('account_id', accountId)
      .order('name');

    if (error) throw error;

    return NextResponse.json({ templates: templates ?? [] });
  } catch (error) {
    console.error('templates integration error', error);
    return NextResponse.json(
      { error: 'Failed to load templates' },
      { status: 500 }
    );
  }
}
