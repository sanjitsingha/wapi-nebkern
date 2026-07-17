import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client for the admin panel.
 *
 * The admin operator is NOT a member of any tenant account, so every
 * read/write here bypasses tenant RLS by design — that's the whole point
 * of a cross-tenant back office. NEVER import this from a client component
 * or a route that isn't behind {@link getAdminUser}.
 *
 * Self-contained on purpose (mirrors the other admin-client helpers in the
 * codebase) so the whole `src/app/admin` folder can be lifted into its own
 * project later with only its shared-import paths to fix up.
 */
let _client: SupabaseClient | null = null;

export function adminDb(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _client;
}
