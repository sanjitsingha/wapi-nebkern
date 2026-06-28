import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import {
  authenticateApiKey,
  requireApiKey,
} from '@/lib/api-keys/auth';

export async function GET(request: Request) {
  try {
    let accountId: string | undefined;

    // Try API key auth first (server-to-server)
    const apiAuth = await authenticateApiKey(request);
    const apiKeyResult = requireApiKey(apiAuth, ['read:templates']);
    if (apiKeyResult instanceof NextResponse) {
      // API key auth failed — fall back to Supabase session auth
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

    // Use admin client for API key requests (no session cookie) or regular client for auth users
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: templates, error } = await adminClient
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
