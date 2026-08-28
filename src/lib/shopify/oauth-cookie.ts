// Shared between the start and callback OAuth routes — kept out of
// either route.ts file since Next.js route handlers may only export
// the recognized HTTP-method/config names, not arbitrary constants.
export const SHOPIFY_OAUTH_STATE_COOKIE = 'shopify_oauth_state';

/**
 * Which store the install was started for.
 *
 * Shopify does round-trip `shop` on the callback, but taking the store
 * from the URL would let anyone hitting the callback name any store
 * they like. Pinning it here — httpOnly, set at start, compared on
 * return — means the domain we install against is one WE chose.
 */
export const SHOPIFY_OAUTH_SHOP_COOKIE = 'shopify_oauth_shop';

/** Both cookies live only for the round trip. */
export const SHOPIFY_OAUTH_COOKIE_PATH = '/api/integrations/shopify/oauth';
