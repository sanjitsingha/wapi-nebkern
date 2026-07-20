import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';

/**
 * GET /api/billing/plans
 *
 * The active plan catalog for the in-app upgrade dialog. Any account
 * member can read it (RLS already exposes active plans to authenticated
 * users); amounts are in minor units.
 */
export async function GET() {
  try {
    const { supabase } = await getCurrentAccount();

    const { data } = await supabase
      .from('billing_plans')
      .select('key, name, tagline, amount, currency, interval, features, is_featured')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    const plans = (data ?? []).map((p) => ({
      key: p.key as string,
      name: p.name as string,
      tagline: (p.tagline as string | null) ?? null,
      amount: p.amount as number,
      currency: p.currency as string,
      interval: p.interval as 'monthly' | 'yearly',
      features: Array.isArray(p.features)
        ? (p.features.filter((f) => typeof f === 'string') as string[])
        : [],
      isFeatured: p.is_featured === true,
    }));

    return NextResponse.json({ plans });
  } catch (err) {
    return toErrorResponse(err);
  }
}
