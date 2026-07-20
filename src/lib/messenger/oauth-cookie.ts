// Shared between the start and callback OAuth routes — kept out of
// either route.ts file since Next.js route handlers may only export the
// recognized HTTP-method/config names, not arbitrary constants.
export const MESSENGER_OAUTH_STATE_COOKIE = 'fb_oauth_state';
