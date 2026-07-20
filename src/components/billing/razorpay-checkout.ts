'use client';

// ============================================================
// Razorpay Standard Web Checkout — client helper.
//
// Flow: POST /api/billing/razorpay/order (amount + key id come from the
// server) → open the Razorpay modal → on success POST the three
// verification fields to /api/billing/razorpay/verify, which activates
// the plan. The key SECRET never exists client-side.
// ============================================================

interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  handler: (response: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
}

interface RazorpayInstance {
  open(): void;
  on(
    event: 'payment.failed',
    cb: (response: { error: { description?: string; reason?: string } }) => void,
  ): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let scriptPromise: Promise<boolean> | null = null;

/** Inject checkout.js once; resolves false if the script can't load
 *  (offline, blocked by an extension). */
function loadCheckoutScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  if (!scriptPromise) {
    scriptPromise = new Promise<boolean>((resolve) => {
      const script = document.createElement('script');
      script.src = CHECKOUT_SRC;
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        scriptPromise = null; // allow a retry on the next attempt
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
}

export interface PaymentResult {
  planName: string;
  periodEnd: string | null;
  invoiceNumber: string | null;
}

/**
 * Run the whole purchase flow for a plan. Resolves with the activation
 * result on success, `null` when the user dismissed the modal, and
 * throws Error(message) on any failure worth surfacing.
 */
export async function payForPlan(planKey: string): Promise<PaymentResult | null> {
  const scriptReady = await loadCheckoutScript();
  if (!scriptReady || !window.Razorpay) {
    throw new Error('Could not load the payment window — check your connection.');
  }

  const orderRes = await fetch('/api/billing/razorpay/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan_key: planKey }),
  });
  const order = await orderRes.json().catch(() => ({}));
  if (!orderRes.ok) {
    throw new Error(order.error ?? 'Could not start the payment.');
  }

  return new Promise<PaymentResult | null>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };

    const rzp = new window.Razorpay!({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'wacrm',
      description: `${order.planName} plan`,
      order_id: order.orderId,
      // Brand green — matches --primary (#0b6623).
      theme: { color: '#0b6623' },
      modal: {
        ondismiss: () => settle(() => resolve(null)),
      },
      handler: (response) => {
        // Payment authorized — verify server-side before claiming success.
        fetch('/api/billing/razorpay/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(response),
        })
          .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(body.error ?? 'Payment verification failed.');
            }
            settle(() =>
              resolve({
                planName: body.planName ?? order.planName,
                periodEnd: body.periodEnd ?? null,
                invoiceNumber: body.invoiceNumber ?? null,
              }),
            );
          })
          .catch((err: Error) => settle(() => reject(err)));
      },
    });

    rzp.on('payment.failed', (response) => {
      settle(() =>
        reject(
          new Error(
            response.error?.description ??
              'The payment failed — you have not been charged.',
          ),
        ),
      );
    });

    rzp.open();
  });
}
