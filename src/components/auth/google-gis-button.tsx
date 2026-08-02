'use client';

import { useEffect, useRef, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { GoogleAuthButton } from '@/components/auth/google-button';
import {
  createNonce,
  googleClientId,
  loadGis,
} from '@/lib/auth/google-gis';

interface GoogleGisButtonProps {
  /** Where to send the user once the session exists. */
  destination: string;
  /** Visible copy on the app-styled face, e.g. "Continue with Google". */
  label: string;
  /**
   * Google's own button copy. Never seen — the real button is
   * transparent — but it is the control's accessible name, so it should
   * still read sensibly to a screen reader.
   */
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  onError: (message: string) => void;
  /** Rendered instead of the Google button if GIS can't load at all. */
  fallback: React.ReactNode;
}

/**
 * "Sign in with Google" without a redirect through supabase.co.
 *
 * Google's own rendered button is used rather than the app's styled one:
 * `google.accounts.id` only exposes `renderButton` and `prompt` for
 * getting an ID token, and Google's branding terms require their button
 * when you use it. So this looks different from the password form's
 * buttons — that's the trade for the domain name on the consent card.
 *
 * Navigation is a full document load, not router.push: the session lands
 * in cookies and the middleware's gates (/welcome, /onboarding) are
 * evaluated server-side, so a client transition could route against a
 * stale session and bounce the user straight back.
 */
export function GoogleGisButton({
  destination,
  label,
  text = 'continue_with',
  onError,
  fallback,
}: GoogleGisButtonProps) {
  const holder = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // Ref, not state: the GIS callback is registered once at initialize()
  // and closes over whatever it captured then — a state value would be
  // frozen at its first render inside that closure. Kept current from an
  // effect rather than assigned during render, which React forbids.
  const destinationRef = useRef(destination);
  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  // Read during render, not in the effect: a missing client id is known
  // before mount, so it decides what to render instead of mounting and
  // then flipping state.
  const clientId = googleClientId();

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    (async () => {
      const ok = await loadGis();
      const id = window.google?.accounts?.id;
      if (cancelled) return;
      if (!ok || !id || !holder.current) {
        setFailed(true);
        return;
      }

      const nonce = await createNonce();
      if (cancelled) return;

      id.initialize({
        client_id: clientId,
        nonce: nonce.hashed,
        // One Tap's auto-select would sign a returning visitor in the
        // instant this page loads, with no gesture. On a login screen
        // that's startling; make them press the button.
        auto_select: false,
        callback: async (response) => {
          try {
            const supabase = createClient();
            const { error } = await supabase.auth.signInWithIdToken({
              provider: 'google',
              token: response.credential,
              nonce: nonce.raw,
            });
            if (error) {
              onError(error.message);
              return;
            }
            window.location.href = destinationRef.current;
          } catch (err) {
            onError(
              err instanceof Error ? err.message : 'Google sign-in failed.',
            );
          }
        },
      });

      // This button is never seen — CSS stretches it over the styled face
      // and drops it to opacity 0. Width still has to be a real number
      // (Google caps it at 400) or it renders at its own intrinsic size
      // and leaves part of the face unclickable.
      id.renderButton(holder.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        logo_alignment: 'center',
        text,
        width: 384,
      });
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, onError, text]);

  // GIS unreachable (no client id, offline, blocked, CSP) — the redirect
  // button still works, so hand back a sign-in that functions over a
  // prettier one that doesn't.
  if (!clientId || failed) return <>{fallback}</>;

  // Google's button is the real control but is painted transparent and
  // stretched over the app's own button, which is what the user sees.
  //
  // The overlay is necessary, not decorative: `google.accounts.id` only
  // hands back an ID token through `renderButton` or One Tap, so there is
  // no click handler to attach to a button of our own. The alternative is
  // Google's grey pill sitting next to the app's rounded controls.
  //
  // Both layers must be the same size — `h-12` here, and the child
  // selectors force Google's fixed-size div/iframe to fill it, otherwise
  // the bottom strip of the visible button does nothing when clicked.
  return (
    <div className="group relative h-12 w-full">
      <GoogleAuthButton label={label} decorative />
      <div
        ref={holder}
        aria-busy={!ready}
        className="absolute inset-0 cursor-pointer overflow-hidden opacity-0 [&_iframe]:h-full! [&_iframe]:w-full! [&>div]:h-full! [&>div]:w-full!"
      />
    </div>
  );
}
