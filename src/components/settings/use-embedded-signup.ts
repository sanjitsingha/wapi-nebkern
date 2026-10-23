'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Must match META_API_VERSION in src/lib/whatsapp/meta-api.ts so the
// browser SDK and our server calls speak the same Graph API version.
const GRAPH_VERSION = 'v21.0';

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const CONFIG_ID = process.env.NEXT_PUBLIC_META_ES_CONFIG_ID;

/** False until the Meta app's public ids are set; the token path is the only way in then. */
export const embeddedSignupAvailable = Boolean(APP_ID && CONFIG_ID);

// Minimal shape of the global the Facebook JS SDK installs. We only
// touch the two methods we use, so a hand-written interface keeps us
// off `any` without pulling in the full FB typings.
interface FacebookSDK {
  init(params: {
    appId: string;
    autoLogAppEvents?: boolean;
    xfbml?: boolean;
    version: string;
  }): void;
  login(
    callback: (response: {
      authResponse?: { code?: string } | null;
      status?: string;
    }) => void,
    options: Record<string, unknown>,
  ): void;
}

declare global {
  interface Window {
    FB?: FacebookSDK;
    fbAsyncInit?: () => void;
  }
}

/** Inject the Facebook JS SDK exactly once and resolve when FB is ready. */
function loadFacebookSdk(appId: string): Promise<FacebookSDK> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Facebook SDK can only load in the browser.'));
      return;
    }
    if (window.FB) {
      resolve(window.FB);
      return;
    }

    window.fbAsyncInit = () => {
      window.FB!.init({
        appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: GRAPH_VERSION,
      });
      resolve(window.FB!);
    };

    const existing = document.getElementById('facebook-jssdk');
    if (existing) return; // script tag already in flight; fbAsyncInit will fire

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = `https://connect.facebook.net/en_US/sdk.js`;
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => reject(new Error('Failed to load the Facebook SDK.'));
    document.body.appendChild(script);
  });
}

/**
 * Where the connection is: `login` while the Facebook window is open,
 * `finishing` while POST /api/whatsapp/embedded-signup does the setup.
 */
export type EmbeddedSignupPhase = 'idle' | 'login' | 'finishing' | 'done' | 'failed';

/** Which server step failed, as tagged by the embedded-signup route. */
export type EmbeddedSignupStep = 'exchange' | 'account' | 'number' | 'subscribe' | 'save';

export interface EmbeddedSignupFailure {
  message: string;
  /** Absent when the Facebook window was closed or never opened. */
  step?: EmbeddedSignupStep;
}

/**
 * Meta Embedded Signup as a hook, so the connect wizard can draw its
 * own progress: launches FB.login, captures the authorization code plus
 * the WABA / phone-number ids Meta reports via its sessionInfo
 * `message` event, and hands them to POST /api/whatsapp/embedded-signup
 * to complete onboarding server-side.
 */
export function useEmbeddedSignup({ onConnected }: { onConnected: () => void }) {
  const [phase, setPhase] = useState<EmbeddedSignupPhase>('idle');
  const [failure, setFailure] = useState<EmbeddedSignupFailure | null>(null);
  // Latest sessionInfo (waba_id + phone_number_id) reported by the
  // Embedded Signup window. Captured via postMessage; read when
  // FB.login's callback fires with the code.
  const sessionInfoRef = useRef<{ waba_id?: string; phone_number_id?: string }>({});

  // Listen for Embedded Signup's postMessage events for the whole
  // lifetime of the component — the message can arrive before OR after
  // the FB.login callback depending on timing.
  useEffect(() => {
    if (!embeddedSignupAvailable) return;
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== 'https://www.facebook.com' &&
        event.origin !== 'https://web.facebook.com'
      ) {
        return;
      }
      try {
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'WA_EMBEDDED_SIGNUP') {
          // data.event: 'FINISH' | 'CANCEL' | 'ERROR'
          if (data.data?.waba_id || data.data?.phone_number_id) {
            sessionInfoRef.current = {
              waba_id: data.data.waba_id,
              phone_number_id: data.data.phone_number_id,
            };
          }
        }
      } catch {
        // Non-JSON postMessage from Facebook — ignore.
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const fail = useCallback((value: EmbeddedSignupFailure) => {
    setFailure(value);
    setPhase('failed');
  }, []);

  const completeOnboarding = useCallback(
    async (code: string) => {
      setPhase('finishing');
      try {
        const res = await fetch('/api/whatsapp/embedded-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            waba_id: sessionInfoRef.current.waba_id,
            phone_number_id: sessionInfoRef.current.phone_number_id,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          fail({ message: data.error || 'Onboarding failed.', step: data.step });
          return;
        }
        // Saved — even when Meta still wants the number's own PIN, the
        // connected page picks it up from there.
        setPhase('done');
        onConnected();
      } catch (err) {
        console.error('Embedded Signup completion failed:', err);
        fail({ message: 'Could not reach Dripo to finish the setup. Check your connection and try again.' });
      }
    },
    [fail, onConnected],
  );

  const launch = useCallback(async () => {
    if (!APP_ID || !CONFIG_ID) return;
    setFailure(null);
    setPhase('login');
    sessionInfoRef.current = {};
    try {
      const FB = await loadFacebookSdk(APP_ID);
      FB.login(
        (response) => {
          const code = response?.authResponse?.code;
          if (!code) {
            fail({
              message:
                'The Facebook window closed before the setup finished. Nothing was changed — try again when you’re ready.',
            });
            return;
          }
          void completeOnboarding(code);
        },
        {
          config_id: CONFIG_ID,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: '',
            sessionInfoVersion: '3',
          },
        },
      );
    } catch (err) {
      console.error('Embedded Signup launch failed:', err);
      fail({
        message:
          err instanceof Error
            ? `${err.message} If an ad blocker is on, allow facebook.com and try again.`
            : 'Could not open the Facebook window.',
      });
    }
  }, [completeOnboarding, fail]);

  return { phase, failure, launch };
}
