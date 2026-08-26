// ============================================================
// POST /api/integrations/shopify/webhook/[token]
//
// Shopify delivers order events here. The [token] identifies the
// connection; the payload's HMAC (x-shopify-hmac-sha256) is verified with
// that connection's (decrypted) API secret. On a new order we upsert the
// customer as a contact, record the order, and fire the `shopify_order`
// automation trigger. Unauthenticated by design — token + signature are
// the auth. Always 200 on handled events so Shopify doesn't retry.
// ============================================================

import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/billing/admin-client';
import { decrypt } from '@/lib/whatsapp/encryption';
import { normalizeOrder, verifyShopifySignature } from '@/lib/shopify/client';
import { upsertContactFromOrder } from '@/lib/shopify/ingest';
import { runAutomationsForTrigger } from '@/lib/automations/engine';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) return new NextResponse('Not found', { status: 404 });

  const db = supabaseAdmin();
  const { data: conn } = await db
    .from('shopify_connections')
    .select('id, account_id, api_secret, is_active')
    .eq('webhook_token', token)
    .maybeSingle();

  if (!conn || !conn.is_active) {
    return new NextResponse('Not found', { status: 404 });
  }

  const rawBody = await request.text();
  const hmac = request.headers.get('x-shopify-hmac-sha256');
  let apiSecret: string;
  try {
    apiSecret = decrypt(conn.api_secret as string);
  } catch {
    return new NextResponse('Server error', { status: 500 });
  }
  if (!verifyShopifySignature(rawBody, hmac, apiSecret)) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const topic = request.headers.get('x-shopify-topic'); // e.g. orders/create
  if (topic && !topic.startsWith('orders/')) {
    return NextResponse.json({ ok: true });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const order = normalizeOrder(payload);
  if (!order) return NextResponse.json({ ok: true });

  const accountId = conn.account_id as string;

  const { data: account } = await db
    .from('accounts')
    .select('owner_user_id')
    .eq('id', accountId)
    .maybeSingle();
  const ownerUserId = account?.owner_user_id as string | undefined;
  if (!ownerUserId) return NextResponse.json({ ok: true });

  const ingest = await upsertContactFromOrder(db, accountId, ownerUserId, order);

  await db.from('shopify_orders').upsert(
    {
      account_id: accountId,
      connection_id: conn.id,
      shopify_order_id: order.shopifyOrderId,
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
    { onConflict: 'account_id,shopify_order_id' },
  );

  await db
    .from('shopify_connections')
    .update({ last_event_at: new Date().toISOString() })
    .eq('id', conn.id);

  const isNewOrder = !topic || topic === 'orders/create';
  if (isNewOrder && ingest.contactId) {
    const p = payload as Record<string, unknown>;
    const customer = (p.customer ?? {}) as Record<string, unknown>;
    const lineItems = Array.isArray(p.line_items)
      ? (p.line_items as Array<Record<string, unknown>>)
      : [];
    const itemsSummary = lineItems
      .map((li) => `${li.quantity ?? 1}× ${li.title ?? li.name ?? 'item'}`)
      .join(', ');
    const shipping = (p.shipping_address ?? {}) as Record<string, unknown>;
    const billing = (p.billing_address ?? {}) as Record<string, unknown>;

    await runAutomationsForTrigger({
      accountId,
      triggerType: 'shopify_order',
      contactId: ingest.contactId,
      context: {
        vars: {
          order_id: order.shopifyOrderId,
          order_number: order.number ?? '',
          order_status: order.status ?? '',
          order_total: order.total ?? '',
          order_currency: order.currency ?? '',
          customer_name: order.name ?? '',
          customer_first_name: (customer.first_name as string) ?? '',
          customer_email: order.email ?? '',
          customer_phone: order.phone ?? '',
          order_items: itemsSummary,
          item_count: lineItems.length,
          shipping_city:
            (shipping.city as string) || (billing.city as string) || '',
          order_date: (p.created_at as string) ?? '',
        },
      },
    });
  }

  return NextResponse.json({ ok: true });
}
