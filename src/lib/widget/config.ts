/**
 * Configuration for the embeddable WhatsApp chat widget.
 *
 * This module is shared by three callers with very different trust
 * levels, which is why sanitization lives here rather than in any one
 * of them:
 *   - the settings UI (typed by an admin),
 *   - the authed save route (must not trust the request body),
 *   - the public loader (renders these values into JS + CSS served to
 *     someone else's website).
 */

import { MAX_MESSAGE_CHARS } from '@/lib/qr/wa-link';

export type WidgetPlacement = 'left' | 'right';

export interface WidgetConfig {
  enabled: boolean;
  /** Snapshot of the account's connected WhatsApp number. Never typed. */
  phone: string;
  prefilledMessage: string;
  businessName: string;
  tagline: string;
  greeting: string;
  /** `#rrggbb`. Interpolated into CSS, so strictly validated below. */
  brandColor: string;
  placement: WidgetPlacement;
  /** Seconds before the panel opens itself. null = never. */
  autoOpenDelaySeconds: number | null;
  showOnMobile: boolean;
  showOnDesktop: boolean;
}

/** WhatsApp's own green. Matches what people expect a WA button to look like. */
export const DEFAULT_BRAND_COLOR = '#25D366';

export const WIDGET_LIMITS = {
  businessName: 60,
  tagline: 80,
  greeting: 300,
  prefilledMessage: MAX_MESSAGE_CHARS,
  /** Longer than this and the visitor has already scrolled past. */
  autoOpenDelaySeconds: 300,
} as const;

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  enabled: true,
  phone: '',
  prefilledMessage: '',
  businessName: '',
  tagline: 'Typically replies within minutes',
  greeting: 'Hi there! How can we help you today?',
  brandColor: DEFAULT_BRAND_COLOR,
  placement: 'right',
  autoOpenDelaySeconds: null,
  showOnMobile: true,
  showOnDesktop: true,
};

/**
 * Strict `#rgb` / `#rrggbb`. The colour is interpolated straight into a
 * stylesheet on a third-party page, so anything that isn't provably a
 * hex literal is rejected rather than escaped — there is no legitimate
 * reason for this field to contain anything else.
 */
export function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

/**
 * Trim a free-text field to length and drop characters that would
 * survive into the widget's DOM as invisible junk: C0/C1 controls
 * (tab and newline excepted — both are legitimate in a greeting) and
 * the U+2028/2029 line separators.
 *
 * Done with a code-point scan rather than a regex on purpose: a
 * character class of literal control bytes is invisible in review and
 * trivially mangled by an editor.
 */
function str(value: unknown, max: number, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  let out = '';
  for (const ch of value) {
    if (ch === '\t' || ch === '\n') {
      out += ch;
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    const isControl = code < 0x20 || (code >= 0x7f && code <= 0x9f);
    const isSeparator = code === 0x2028 || code === 0x2029;
    if (isControl || isSeparator) continue;
    out += ch;
  }
  return out.slice(0, max);
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Coerce anything into a valid config. Invalid fields fall back to their
 * default instead of failing the whole save — a bad colour shouldn't
 * cost someone the greeting they just wrote. The UI constrains these
 * inputs anyway; this is the backstop for the raw HTTP body.
 */
export function sanitizeWidgetConfig(input: unknown): WidgetConfig {
  const raw = (input ?? {}) as Record<string, unknown>;
  const d = DEFAULT_WIDGET_CONFIG;

  const brandColor =
    typeof raw.brandColor === 'string' && isHexColor(raw.brandColor)
      ? raw.brandColor
      : d.brandColor;

  const placement: WidgetPlacement =
    raw.placement === 'left' || raw.placement === 'right'
      ? raw.placement
      : d.placement;

  let autoOpenDelaySeconds: number | null = null;
  if (typeof raw.autoOpenDelaySeconds === 'number') {
    const n = Math.round(raw.autoOpenDelaySeconds);
    if (Number.isFinite(n) && n >= 0) {
      autoOpenDelaySeconds = Math.min(n, WIDGET_LIMITS.autoOpenDelaySeconds);
    }
  }

  return {
    enabled: bool(raw.enabled, d.enabled),
    // Digits only — this feeds a wa.me URL. The value is a snapshot of
    // the connected number written by the server, but it round-trips
    // through the client on save, so re-clean it here.
    phone: str(raw.phone, 20, d.phone).replace(/\D/g, ''),
    prefilledMessage: str(
      raw.prefilledMessage,
      WIDGET_LIMITS.prefilledMessage,
      d.prefilledMessage,
    ),
    businessName: str(
      raw.businessName,
      WIDGET_LIMITS.businessName,
      d.businessName,
    ),
    tagline: str(raw.tagline, WIDGET_LIMITS.tagline, d.tagline),
    greeting: str(raw.greeting, WIDGET_LIMITS.greeting, d.greeting),
    brandColor,
    placement,
    autoOpenDelaySeconds,
    showOnMobile: bool(raw.showOnMobile, d.showOnMobile),
    showOnDesktop: bool(raw.showOnDesktop, d.showOnDesktop),
  };
}

/** DB row shape (snake_case) → config. */
export function widgetConfigFromRow(row: Record<string, unknown>): WidgetConfig {
  return sanitizeWidgetConfig({
    enabled: row.enabled,
    phone: row.phone ?? '',
    prefilledMessage: row.prefilled_message,
    businessName: row.business_name,
    tagline: row.tagline,
    greeting: row.greeting,
    brandColor: row.brand_color,
    placement: row.placement,
    autoOpenDelaySeconds: row.auto_open_delay_seconds ?? null,
    showOnMobile: row.show_on_mobile,
    showOnDesktop: row.show_on_desktop,
  });
}

/** Config → DB row shape (snake_case). */
export function widgetConfigToRow(config: WidgetConfig) {
  return {
    enabled: config.enabled,
    phone: config.phone || null,
    prefilled_message: config.prefilledMessage,
    business_name: config.businessName,
    tagline: config.tagline,
    greeting: config.greeting,
    brand_color: config.brandColor,
    placement: config.placement,
    auto_open_delay_seconds: config.autoOpenDelaySeconds,
    show_on_mobile: config.showOnMobile,
    show_on_desktop: config.showOnDesktop,
  };
}

/**
 * URL-safe random identifier for the public loader. Not a secret — it
 * ships in the customer's page source — just unguessable enough that
 * nobody enumerates other accounts' widgets, and rotatable so a widget
 * left on a site you no longer control can be killed.
 */
export function generatePublicKey(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The snippet the customer pastes into their site, right before
 * </body>. `async` so it never blocks their page render.
 */
export function buildEmbedSnippet(origin: string, publicKey: string): string {
  const base = origin.replace(/\/+$/, '');
  return `<script src="${base}/widget.js?id=${publicKey}" async></script>`;
}
