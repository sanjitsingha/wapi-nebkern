import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * DELETE /api/api-keys/[id]
 * Revoke (soft-delete) an API key by id. Only works if the caller belongs
 * to the same account as the key.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Verify the key exists and belongs to the caller's account before revoking
    const { data: keyRow } = await supabase
      .from('api_keys')
      .select('id')
      .eq('id', id)
      .eq('account_id', accountId)
      .maybeSingle();

    if (!keyRow) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }

    const { error: updateErr } = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id);

    if (updateErr) {
      console.error('[api-keys] revoke failed:', updateErr);
      return NextResponse.json(
        { error: 'Failed to revoke API key' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api-keys] DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
