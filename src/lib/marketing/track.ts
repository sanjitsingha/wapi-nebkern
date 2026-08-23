// ============================================================
// Marketing analytics — fire a named event to whichever provider the
// page already loaded (Umami and/or GA4). See src/components/analytics.tsx:
// both are scoped to the public marketing + docs surface, so this is only
// meaningful there. No-ops safely when neither script is present (a fork
// with analytics unconfigured, SSR, or a visitor who declined GA cookies).
// ============================================================

type Props = Record<string, string | number | boolean | undefined>;

interface UmamiGlobal {
  track?: (event: string, data?: Props) => void;
}
type GtagFn = (command: 'event', event: string, params?: Props) => void;

export function track(event: string, props?: Props): void {
  if (typeof window === 'undefined') return;
  const w = window as typeof window & { umami?: UmamiGlobal; gtag?: GtagFn };
  try {
    w.umami?.track?.(event, props);
  } catch {
    /* analytics must never break the page */
  }
  try {
    w.gtag?.('event', event, props);
  } catch {
    /* ditto */
  }
}
