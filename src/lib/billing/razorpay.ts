import { createHmac, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';

// ============================================================
// Razorpay server helpers — Standard Web Checkout.
//
// Server-only: needs RAZORPAY_KEY_SECRET. The publishable key id is
// handed to the browser via the order endpoint's response (no
// NEXT_PUBLIC_ inlining needed), the secret never leaves the server.
//
// Test keys behave identically to live ones — swap the env values to
// go live. See docs/billing-and-trial.md for the billing model this
// plugs into (accounts billing columns, invoices ledger).
// ============================================================

export function razorpayKeyId(): string | undefined {
  return process.env.RAZORPAY_KEY_ID;
}

/** True when both Razorpay env vars are set (checkout can be offered). */
export function razorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

let _instance: Razorpay | null = null;

/** Lazy shared SDK instance. Throws if the env isn't configured —
 *  callers should gate on razorpayConfigured() first. */
export function razorpay(): Razorpay {
  if (!_instance) {
    if (!razorpayConfigured()) {
      throw new Error('Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)');
    }
    _instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return _instance;
}

/**
 * Verify a Standard Checkout payment signature:
 * HMAC-SHA256(`${order_id}|${payment_id}`, KEY_SECRET) must equal the
 * signature Razorpay handed to the success handler. Constant-time
 * comparison; any malformed input verifies false rather than throwing.
 */
export function verifyPaymentSignature({
  orderId,
  paymentId,
  signature,
}: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
