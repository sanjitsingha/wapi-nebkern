import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazy, shared service-role client for the scheduled-broadcast dispatcher.
// Mirrors src/lib/flows/admin-client.ts and src/lib/automations/admin-client.ts
// — same shape so the convention is obvious across the codebase.
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
