import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';

/**
 * GET /api/webhooks/deliveries — recent delivery attempts for the account
 * (any member), newest first. Powers the activity log in the UI.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const { data, error } = await supabase
      .from('webhook_deliveries')
      .select(
        'id, endpoint_id, event_type, status, attempts, response_status, error, created_at, delivered_at',
      )
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('[webhooks/deliveries] error:', error);
      return NextResponse.json({ error: 'Failed to load deliveries' }, { status: 500 });
    }
    return NextResponse.json({ deliveries: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}
