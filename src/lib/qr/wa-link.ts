/**
 * Click-to-chat deep links for the QR generator.
 *
 * A wa.me link is `https://wa.me/<digits>?text=<urlencoded>`: scanning it
 * opens WhatsApp on the customer's phone with the business in the "to"
 * field and the message already typed, so all they do is hit send. The
 * number must be plain international digits — wa.me rejects `+`, spaces,
 * and the `00` international prefix.
 */

/** Hard cap on the pre-filled message. See DENSE_MESSAGE_CHARS below. */
export const MAX_MESSAGE_CHARS = 700;

/**
 * Past roughly this many characters the QR needs more modules to encode,
 * so the printed squares get small enough that phone cameras struggle
 * from a distance (posters, table tents). Not an error — just a nudge.
 */
export const DENSE_MESSAGE_CHARS = 250;

/**
 * Strip a typed number down to what wa.me accepts: digits only, no
 * leading zeros. Handles the three ways people write the same number —
 * "+91 98765 43210", "0091-9876543210", "919876543210" — which all
 * normalize to "919876543210".
 */
export function normalizeWaNumber(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+/, '');
}

/**
 * True when the normalized number is a plausible international number.
 * E.164 allows 15 digits max; below 7 there is no country + subscriber
 * number. We can't tell whether the number is actually on WhatsApp —
 * that only surfaces when someone scans.
 */
export function isValidWaNumber(normalized: string): boolean {
  return /^[1-9]\d{6,14}$/.test(normalized);
}

export interface WaLinkInput {
  /** As typed by the user — normalized here, so callers needn't. */
  number: string;
  /** Pre-filled message. Empty means "just open the chat". */
  message?: string;
}

/**
 * Build the deep link. Returns null when the number isn't usable yet,
 * which is the normal state while someone is still typing — callers
 * render the empty preview rather than an error.
 */
export function buildWaLink({ number, message }: WaLinkInput): string | null {
  const digits = normalizeWaNumber(number);
  if (!isValidWaNumber(digits)) return null;

  const text = (message ?? '').slice(0, MAX_MESSAGE_CHARS);
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/**
 * Filename for the downloaded image: `whatsapp-qr-919876543210.png`.
 * Stable per number so re-downloading overwrites rather than piling up
 * "(1)" copies in the Downloads folder.
 */
export function qrFileName(number: string, ext: 'png' | 'svg'): string {
  const digits = normalizeWaNumber(number);
  return `whatsapp-qr-${digits || 'code'}.${ext}`;
}

/** Ready-made openers to drop into the message box. */
export const MESSAGE_PRESETS: { label: string; message: string }[] = [
  { label: 'General enquiry', message: "Hi! I'd like to know more." },
  {
    label: 'Pricing',
    message: 'Hi! Could you share your pricing and packages?',
  },
  {
    label: 'Book appointment',
    message: "Hi! I'd like to book an appointment.",
  },
  { label: 'Order status', message: 'Hi! I want to check my order status.' },
  { label: 'Support', message: 'Hi! I need help with something.' },
];
