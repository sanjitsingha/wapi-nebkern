import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazy, shared service-role client for account lifecycle work — the
// deletion window, its recovery tokens, and the purge sweep. Mirrors
// src/lib/broadcasts/admin-client.ts and the others, same shape so the
// convention is obvious across the codebase.
//
// Service-role rather than the caller's RLS client on purpose: recovery
// runs for a signed-OUT visitor (nobody can be signed in to a locked
// account), and the purge runs from cron with no user at all.
let _adminClient: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _adminClient;
}
