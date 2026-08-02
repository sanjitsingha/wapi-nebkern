'use client';

// ============================================================
// Google Identity Services — the no-redirect sign-in path.
//
// Why this exists at all: `signInWithOAuth` hands the browser to Supabase,
// and GoTrue builds the Google `redirect_uri` from ITS OWN hostname. So the
// consent screen reads "to continue to <project-ref>.supabase.co" and no
// amount of OAuth-consent-screen branding changes it — Google will only
// print a name for a domain you can prove you own in Search Console, and
// nobody owns supabase.co but Supabase.
//
// GIS sidesteps the whole thing: Google hands an ID token straight to the
// page, we pass it to `signInWithIdToken`, and no redirect to supabase.co
// ever happens. Google shows YOUR origin.
//
// Gated behind NEXT_PUBLIC_GOOGLE_GIS so the redirect path stays the
// default until this is proven against a real Google account in a real
// browser — see googleGisEnabled().
//
// NOT a replacement for the redirect flow. `linkIdentity` (attaching
// Google to an existing account, in Settings → Security) has no ID-token
// equivalent in supabase-js, so that screen keeps redirecting and keeps
// showing the supabase.co hostname.
// ============================================================

export const GIS_SRC = 'https://accounts.google.com/gsi/client';

export function googleClientId(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || undefined;
}

/**
 * On only when explicitly switched on AND a client id is present —
 * a half-configured deploy silently falls back to the redirect button
 * rather than rendering a button that can never work.
 */
export function googleGisEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GOOGLE_GIS === '1' && !!googleClientId();
}

interface GisCredentialResponse {
  credential: string;
}

interface GisIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: GisCredentialResponse) => void;
    nonce?: string;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with';
      shape?: 'rectangular' | 'pill';
      logo_alignment?: 'left' | 'center';
      width?: number;
    },
  ): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GisIdApi } };
  }
}

let scriptPromise: Promise<boolean> | null = null;

/** Inject the GIS script once. Resolves false if it can't load (offline,
 *  blocked by an extension, CSP) so callers can fall back rather than hang. */
export function loadGis(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.google?.accounts?.id) return Promise.resolve(true);
  if (!scriptPromise) {
    scriptPromise = new Promise<boolean>((resolve) => {
      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${GIS_SRC}"]`,
      );
      if (existing) {
        existing.addEventListener('load', () => resolve(true));
        existing.addEventListener('error', () => resolve(false));
        return;
      }
      const script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        scriptPromise = null; // let a later attempt retry
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export interface GisNonce {
  /** Hashed — what Google gets, and what it embeds in the ID token. */
  hashed: string;
  /** Raw — what Supabase gets, so it can verify the hash matches. */
  raw: string;
}

/**
 * Google is handed the SHA-256 of the nonce; Supabase is handed the
 * original. Supabase re-hashes it and compares against the token's claim,
 * which is what stops a token minted for another page being replayed here.
 * Passing the same string to both fails verification — the asymmetry is
 * the point, not an oversight.
 */
export async function createNonce(): Promise<GisNonce> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes));
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(raw),
  );
  const hashed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { hashed, raw };
}
