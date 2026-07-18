import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateApiKey, hashKey } from '@/lib/api-keys/auth';
import {
  featureBlockedResponse,
  getAccountEntitlements,
} from '@/lib/billing/entitlements';

/**
 * POST /api/api-keys
 * Create a new API key for the current user's account.
 *
 * Body: { name?: string, scopes?: string[] }
 * Response: { key: string, id: string, name: string, scopes: string[] }
 *
 * The raw key is returned ONLY in this response. It is never shown again.
 */
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

    // Plan gate — API access is part of the integrations feature (062).
    const ent = await getAccountEntitlements(supabase, accountId);
    if (!ent.allowIntegrations) {
      return featureBlockedResponse('API access & integrations');
    }

    const body = await request.json().catch(() => ({}));
    const name =
      typeof body.name === 'string' && body.name.trim()
        ? body.name.trim()
        : 'Integration key';
    const scopes = Array.isArray(body.scopes)
      ? body.scopes.filter((s: unknown) => typeof s === 'string')
      : ['read:templates', 'send:messages'];

    const rawKey = generateApiKey();
    const keyPrefix = rawKey.slice(0, 8); // "wak_xxxx"
    const keyHash = hashKey(rawKey);

    const { data: row, error: insertErr } = await supabase
      .from('api_keys')
      .insert({
        account_id: accountId,
        user_id: user.id,
        name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        scopes,
      })
      .select('id, name, key_prefix, scopes, created_at')
      .single();

    if (insertErr) {
      console.error('[api-keys] insert failed:', insertErr);
      return NextResponse.json(
        { error: 'Failed to create API key' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      key: rawKey, // shown ONLY once
      id: row.id,
      name: row.name,
      scopes: row.scopes,
      created_at: row.created_at,
    });
  } catch (error) {
    console.error('[api-keys] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/api-keys
 * List all API keys for the current user's account (excluding the full hash).
 */
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
      .from('api_keys')
      .select(
        'id, name, key_prefix, scopes, last_used_at, created_at, revoked_at, expires_at'
      )
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[api-keys] select failed:', error);
      return NextResponse.json(
        { error: 'Failed to load API keys' },
        { status: 500 }
      );
    }

    return NextResponse.json({ keys: rows ?? [] });
  } catch (error) {
    console.error('[api-keys] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
