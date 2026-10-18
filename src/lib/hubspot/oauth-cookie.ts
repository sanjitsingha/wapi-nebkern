// Shared by the start and callback OAuth routes — kept out of either
// route.ts, which may only export HTTP-method and config names.
export const HUBSPOT_OAUTH_STATE_COOKIE = 'hubspot_oauth_state';
export const HUBSPOT_OAUTH_COOKIE_PATH = '/api/integrations/hubspot/oauth';
