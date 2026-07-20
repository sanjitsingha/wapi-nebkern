import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazy, shared service-role client for billing writes (plan activation +
// invoice inserts after a verified Razorpay payment). Mirrors
// src/lib/webhooks/admin-client.ts — the accounts billing columns and the
// invoices table have no tenant INSERT/UPDATE policies by design, so the
// verified-payment path must bypass RLS. Only call AFTER the caller's
// account and the payment signature have both been verified.
let _adminClient: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _adminClient;
}
