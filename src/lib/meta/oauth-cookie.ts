/**
 * Cookie that carries the CSRF nonce across the unified Meta login
 * round trip. Its own name (not shared with the per-channel messenger /
 * instagram cookies) so a half-finished legacy handshake can never
 * satisfy this flow's state check, and vice versa.
 *
 * Split into its own module because the middleware-adjacent route
 * handlers on both ends of the redirect need the constant, and the
 * modules holding the rest of the flow pull in the token decryptor.
 */
export const META_OAUTH_STATE_COOKIE = 'meta_oauth_state';
