// Shared between the start and callback OAuth routes — kept out of
// either route.ts file since Next.js route handlers may only export
// the recognized HTTP-method/config names, not arbitrary constants.
export const ZOHO_OAUTH_STATE_COOKIE = 'zoho_oauth_state';

/**
 * Which data centre the connection was started against.
 *
 * Zoho's callback does return a `location`, but the token exchange must
 * hit the SAME accounts host the consent screen was served from — so
 * the choice is pinned at start rather than taken from the returning
 * URL, where it would be attacker-controlled.
 */
export const ZOHO_OAUTH_REGION_COOKIE = 'zoho_oauth_region';

export const ZOHO_OAUTH_COOKIE_PATH = '/api/integrations/zoho/oauth';
