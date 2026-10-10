// Shared between the start and callback OAuth routes — kept out of
// either route.ts file since Next.js route handlers may only export the
// recognized HTTP-method/config names, not arbitrary constants.
export const GSHEETS_OAUTH_STATE_COOKIE = 'gsheets_oauth_state';
export const GSHEETS_OAUTH_COOKIE_PATH = '/api/integrations/google-sheets/oauth';

/** The redirect URI registered in Google Cloud for this connection. */
export function gsheetsRedirectUri(origin: string): string {
  return `${origin}/api/integrations/google-sheets/oauth/callback`;
}
