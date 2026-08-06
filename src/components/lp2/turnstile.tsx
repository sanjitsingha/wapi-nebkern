'use client';

import { useEffect, useRef, useState } from 'react';

// ============================================================
// Cloudflare Turnstile widget.
//
// Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset, which
// keeps the forms working on a fork that has not signed up — the server
// makes the same allowance (src/lib/captcha.ts) and warns in the log.
//
// The script is loaded once per page and reused: two forms on one page
// would otherwise each inject it and race.
// ============================================================

const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        }
      ) => string;
      remove: (id: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SCRIPT_SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('turnstile failed to load'));
    document.head.appendChild(el);
  });
  return scriptPromise;
}

/**
 * Calls `onToken` with a solved token, and with null when it expires.
 * The parent keeps the token in state and sends it with the form.
 */
export function Turnstile({
  onToken,
}: {
  onToken: (t: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // `onToken` in a ref so a parent that passes an inline arrow does not
  // re-render the widget on every keystroke — remounting it mid-form
  // would clear a token the visitor already solved for. Synced in an
  // effect rather than during render: writing to a ref while rendering
  // is exactly what `react-hooks/refs` is there to catch.
  const cb = useRef(onToken);
  useEffect(() => {
    cb.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let widgetId: string | undefined;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          theme: 'light',
          callback: (token) => cb.current(token),
          'expired-callback': () => cb.current(null),
          'error-callback': () => cb.current(null),
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey]);

  if (!siteKey) return null;

  if (failed) {
    return (
      <p className="text-xs font-semibold text-(--lp2-coral)">
        The spam check could not load — please disable your blocker for this
        page, or email us directly.
      </p>
    );
  }

  return <div ref={ref} className="min-h-[65px]" />;
}

/** Whether a token is required before the form may submit. Mirrors the
 *  server's rule so the button is not disabled on a deployment that has
 *  no captcha configured. */
export const captchaRequired = Boolean(
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
);
