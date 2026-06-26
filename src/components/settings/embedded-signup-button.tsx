'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Must match META_API_VERSION in src/lib/whatsapp/meta-api.ts so the
// browser SDK and our server calls speak the same Graph API version.
const GRAPH_VERSION = 'v21.0';

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const CONFIG_ID = process.env.NEXT_PUBLIC_META_ES_CONFIG_ID;

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

interface EmbeddedSignupButtonProps {
  /** Called after the server finishes onboarding so the parent can reload config. */
  onConnected: () => void;
}

/**
 * "Connect with Facebook" — launches Meta Embedded Signup, captures the
 * authorization code + the WABA / phone-number ids Meta reports via its
 * sessionInfo `message` event, and hands them to
 * POST /api/whatsapp/embedded-signup to complete onboarding server-side.
 */
export function EmbeddedSignupButton({ onConnected }: EmbeddedSignupButtonProps) {
  const [launching, setLaunching] = useState(false);
  // Latest sessionInfo (waba_id + phone_number_id) reported by the
  // Embedded Signup window. Captured via postMessage; read when
  // FB.login's callback fires with the code.
  const sessionInfoRef = useRef<{ waba_id?: string; phone_number_id?: string }>({});

  const configured = Boolean(APP_ID && CONFIG_ID);

  // Listen for Embedded Signup's postMessage events for the whole
  // lifetime of the component — the message can arrive before OR after
  // the FB.login callback depending on timing.
  useEffect(() => {
    if (!configured) return;
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
  }, [configured]);

  const completeOnboarding = useCallback(
    async (code: string) => {
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
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'Onboarding failed.', { duration: 12000 });
          return;
        }
        if (data.registered === false && data.registration_error) {
          toast.error(
            `Connected, but Meta couldn't register the number: ${data.registration_error}`,
            { duration: 12000 },
          );
        } else {
          toast.success(
            data.phone_info?.verified_name
              ? `Live — ${data.phone_info.verified_name} is registered and ready.`
              : 'WhatsApp connected and registered. Events will start flowing shortly.',
          );
        }
        onConnected();
      } catch (err) {
        console.error('Embedded Signup completion failed:', err);
        toast.error('Could not reach the onboarding endpoint.');
      } finally {
        setLaunching(false);
      }
    },
    [onConnected],
  );

  const launch = useCallback(async () => {
    if (!APP_ID || !CONFIG_ID) return;
    setLaunching(true);
    sessionInfoRef.current = {};
    try {
      const FB = await loadFacebookSdk(APP_ID);
      FB.login(
        (response) => {
          const code = response?.authResponse?.code;
          if (!code) {
            setLaunching(false);
            if (response?.status !== 'connected') {
              toast.error('Embedded Signup was cancelled before completing.');
            }
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
      toast.error(
        err instanceof Error ? err.message : 'Could not start Embedded Signup.',
      );
      setLaunching(false);
    }
  }, [completeOnboarding]);

  if (!configured) {
    return (
      <p className="text-xs text-muted-foreground">
        One-click onboarding is unavailable: set{' '}
        <code className="text-foreground">NEXT_PUBLIC_META_APP_ID</code> and{' '}
        <code className="text-foreground">NEXT_PUBLIC_META_ES_CONFIG_ID</code> to
        enable Embedded Signup. Enter credentials manually below in the meantime.
      </p>
    );
  }

  return (
    <Button
      onClick={launch}
      disabled={launching}
      className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
    >
      {launching ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Connecting…
        </>
      ) : (
        <>
          <MessageCircle className="size-4" />
          Connect WhatsApp with Facebook
        </>
      )}
    </Button>
  );
}
