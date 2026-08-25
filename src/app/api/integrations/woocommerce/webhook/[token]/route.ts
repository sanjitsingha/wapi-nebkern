// ============================================================
// POST /api/integrations/woocommerce/webhook/[token]
//
// WooCommerce delivers order events here. The [token] identifies the
// connection; the payload's HMAC (x-wc-webhook-signature) is verified
// against that connection's secret. On a new order we upsert the customer
// as a contact, record the order, and fire the `woocommerce_order`
// automation trigger. Unauthenticated by design — the token + signature
// are the auth. Always returns 200 on handled events so Woo doesn't retry.
// ============================================================

import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/billing/admin-client';
import { normalizeOrder, verifyWooSignature } from '@/lib/woocommerce/client';
import { upsertContactFromOrder } from '@/lib/woocommerce/ingest';
import { runAutomationsForTrigger } from '@/lib/automations/engine';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) return new NextResponse('Not found', { status: 404 });

  const db = supabaseAdmin();
  const { data: conn } = await db
    .from('woocommerce_connections')
    .select('id, account_id, webhook_secret, is_active')
    .eq('webhook_token', token)
    .maybeSingle();

  if (!conn || !conn.is_active) {
    return new NextResponse('Not found', { status: 404 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-wc-webhook-signature');
  if (!verifyWooSignature(rawBody, signature, conn.webhook_secret as string)) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  // Only order.* topics matter; anything else (or the creation ping) is a 200.
  const topic = request.headers.get('x-wc-webhook-topic');
  if (topic && !topic.startsWith('order.')) {
    return NextResponse.json({ ok: true });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // The webhook-creation ping isn't a JSON order — acknowledge and move on.
    return NextResponse.json({ ok: true });
  }

  const order = normalizeOrder(payload);
  if (!order) return NextResponse.json({ ok: true });

  const accountId = conn.account_id as string;

  // A NOT NULL user_id FK on contacts/tags needs a sender-of-record.
  const { data: account } = await db
    .from('accounts')
    .select('owner_user_id')
    .eq('id', accountId)
    .maybeSingle();
  const ownerUserId = account?.owner_user_id as string | undefined;
  if (!ownerUserId) return NextResponse.json({ ok: true });

  const ingest = await upsertContactFromOrder(db, accountId, ownerUserId, order);

  // Record the order (idempotent per account + Woo order id).
  await db.from('woocommerce_orders').upsert(
    {
      account_id: accountId,
      connection_id: conn.id,
      wc_order_id: order.wcOrderId,
      contact_id: ingest.contactId,
      number: order.number,
      status: order.status,
      total: order.total,
      currency: order.currency,
      customer_name: order.name,
      customer_phone: order.phone,
      raw: payload as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'account_id,wc_order_id' },
  );

  await db
    .from('woocommerce_connections')
    .update({ last_event_at: new Date().toISOString() })
    .eq('id', conn.id);

  // Fire automations for NEW orders only, once we have a contact to act on.
  const isNewOrder = !topic || topic === 'order.created';
  if (isNewOrder && ingest.contactId) {
    // Order fields the automation can reference as {{vars.<name>}} in a
    // message or template variable.
    const p = payload as Record<string, unknown>;
    const billing = (p.billing ?? {}) as Record<string, unknown>;
    const shipping = (p.shipping ?? {}) as Record<string, unknown>;
    const lineItems = Array.isArray(p.line_items)
      ? (p.line_items as Array<Record<string, unknown>>)
      : [];
    const itemsSummary = lineItems
      .map((li) => `${li.quantity ?? 1}× ${li.name ?? 'item'}`)
      .join(', ');

    await runAutomationsForTrigger({
      accountId,
      triggerType: 'woocommerce_order',
      contactId: ingest.contactId,
      context: {
        vars: {
          order_id: order.wcOrderId,
          order_number: order.number ?? '',
          order_status: order.status ?? '',
          order_total: order.total ?? '',
          order_currency: order.currency ?? '',
          customer_name: order.name ?? '',
          customer_first_name: (billing.first_name as string) ?? '',
          customer_email: order.email ?? '',
          customer_phone: order.phone ?? '',
          order_items: itemsSummary,
          item_count: lineItems.length,
          payment_method: (p.payment_method_title as string) ?? '',
          shipping_city: (shipping.city as string) || (billing.city as string) || '',
          shipping_address:
            [billing.address_1, billing.city, billing.state, billing.postcode]
              .filter(Boolean)
              .join(', '),
          order_date: (p.date_created as string) ?? '',
        },
      },
    });
  }

  return NextResponse.json({ ok: true });
}
