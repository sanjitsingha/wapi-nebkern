import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazy, shared service-role client for the webhooks emit + dispatch paths.
// Mirrors src/lib/broadcasts/admin-client.ts — these run with no auth.uid()
// (background emit, cron dispatcher), so they intentionally bypass RLS.
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
