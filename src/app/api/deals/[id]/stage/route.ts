import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { emitWebhookEvent } from '@/lib/webhooks/emit';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/deals/[id]/stage
 *
 * Move a deal to a new pipeline stage. The pipeline board used to write
 * this directly via the browser client; it goes through here now so the
 * `deal.stage_changed` outbound webhook can fire on the move. RLS scopes
 * the update to the caller's account.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const { id } = await context.params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid deal id' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const stageId = typeof body?.stage_id === 'string' ? body.stage_id : '';
    if (!UUID_RE.test(stageId)) {
      return NextResponse.json({ error: 'Invalid stage_id' }, { status: 400 });
    }
    const fromStageId =
      typeof body?.from_stage_id === 'string' ? body.from_stage_id : null;

    const { data: deal, error } = await supabase
      .from('deals')
      .update({ stage_id: stageId })
      .eq('id', id)
      .select('id, title, value, currency, contact_id, stage_id, pipeline_id')
      .single();

    if (error || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    await emitWebhookEvent(accountId, 'deal.stage_changed', {
      deal_id: deal.id,
      title: deal.title,
      value: deal.value,
      currency: deal.currency,
      contact_id: deal.contact_id,
      pipeline_id: deal.pipeline_id,
      from_stage_id: fromStageId,
      to_stage_id: deal.stage_id,
    });

    return NextResponse.json({ ok: true, deal });
  } catch (err) {
    return toErrorResponse(err);
  }
}
