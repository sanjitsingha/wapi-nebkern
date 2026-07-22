import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Lazy, shared service-role client for the public widget loader.
 *
 * The loader is called by anonymous visitors on someone else's website,
 * so there is no session to scope RLS to. Rather than open a public
 * SELECT policy on whatsapp_widgets — which would expose every account's
 * row to anyone with the anon key — the route reads it with the service
 * role and returns only the handful of presentation fields the browser
 * needs.
 *
 * Mirrors the per-feature pattern already used by automations and flows.
 */
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
