import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazy, shared service-role client for inbox writes that must not be
// silently narrowed by RLS — deleting a chat, where a refused delete
// removes nothing and reports no error. Mirrors
// src/lib/broadcasts/admin-client.ts and the others, same shape so the
// convention is obvious across the codebase.
//
// Every caller authorises first (role + account ownership) on the
// caller's own client; this only runs the write once that has passed.
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
