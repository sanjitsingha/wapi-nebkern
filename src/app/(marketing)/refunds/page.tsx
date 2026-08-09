import type { Metadata } from 'next';

import { LegalPage, type LegalSection } from '@/components/lp2/legal';

// Required, not optional: Indian payment gateways (Razorpay included,
// which is what this app checks out with) will not approve a merchant
// account without a publicly reachable refund/cancellation policy and a
// statement of when the service is delivered. That's why the "service
// delivery" section lives here rather than in the Terms — it's the
// SaaS equivalent of the shipping policy the gateway looks for.
export const metadata: Metadata = {
  title: { absolute: 'Cancellation & Refunds — Instant' },
  description:
    'How to cancel an Instant subscription, when refunds are and are not available, how failed or duplicate payments are handled, and when the service is delivered.',
  robots: { index: true, follow: true },
};

const SECTIONS: LegalSection[] = [
  {
    id: 'how-billing-works',
    heading: 'How billing works',
    blocks: [
      {
        p: 'Instant is a monthly subscription, charged in advance. When you subscribe, you are billed for the month ahead and the plan’s features unlock immediately. The subscription renews automatically each month until you cancel it.',
      },
      {
        p: 'All prices are in Indian Rupees and exclude applicable taxes, which are added where we are required to collect them. Payments are handled by our payment processor; we never store your card or UPI details.',
      },
    ],
  },
  {
    id: 'service-delivery',
    heading: 'When the service is delivered',
    blocks: [
      {
        p: 'Instant is software delivered online. There is nothing to ship. Your plan is activated on your account as soon as payment is confirmed — normally within a few seconds, and in rare cases up to 24 hours if a payment needs manual verification.',
      },
      {
        p: 'Access is delivered to the account you signed up with, at the email address on that account. Connecting your WhatsApp Business number is a separate step you complete yourself through embedded signup, and how long Meta takes to approve it is outside our control.',
      },
      {
        note: 'If your plan has not activated within 24 hours of a successful payment, email {{EMAIL}} with your payment reference and we will fix it or refund you in full.',
      },
    ],
  },
  {
    id: 'free-trial',
    heading: 'Free trial',
    blocks: [
      {
        p: 'Every new account starts with a 14-day free trial that includes all features. No card is required to begin it, so nothing is charged when it ends — the account simply stops sending until you pick a plan. There is nothing to cancel and nothing to refund for a trial.',
      },
    ],
  },
  {
    id: 'cancellation',
    heading: 'Cancelling your subscription',
    blocks: [
      {
        p: 'You can cancel at any time, yourself, from Settings → Billing. No phone call, no retention conversation, no notice period.',
      },
      {
        ul: [
          'Cancellation stops the next renewal. Your plan stays active until the end of the period you have already paid for.',
          'At the end of that period the account moves to a read-only state: you can still sign in and export your data, but you cannot send messages.',
          'Your data is retained as described in our Privacy Policy, so you can reactivate later without losing your history.',
          'To delete your workspace and its data outright rather than just stop billing, email {{EMAIL}} and we will action it.',
        ],
      },
    ],
  },
  {
    id: 'refunds',
    heading: 'When we refund',
    blocks: [
      { p: 'We refund in these situations:' },
      {
        ul: [
          'Duplicate or double charges — refunded in full, always.',
          'A technical failure on our side that made the Service materially unusable for a sustained period and that we could not resolve — refunded pro-rata for the affected time, or in full at our discretion.',
          'A charge taken after you had already cancelled — refunded in full.',
          'A plan that never activated after payment, as described in section 2 — refunded in full.',
          'Where consumer law in your jurisdiction gives you a refund right that overrides this policy — honoured, of course.',
        ],
      },
      { p: 'We do not normally refund:' },
      {
        ul: [
          'Part-used billing periods where you simply changed your mind or stopped using the Service. The 14-day free trial exists so you can evaluate Instant before paying anything.',
          'Charges from Meta for WhatsApp conversations or template messages. Those are billed by Meta on its own terms and we cannot reverse them.',
          'Periods where the Service worked but your WhatsApp number was restricted, throttled or banned by Meta — including as a result of message quality or policy breaches.',
          'Accounts suspended or terminated for breaching our Terms or Acceptable Use Policy.',
        ],
      },
      {
        note: 'Downgrading mid-cycle does not generate a refund of the difference; the lower price applies from your next renewal. Upgrading takes effect immediately and is charged pro-rata.',
      },
    ],
  },
  {
    id: 'failed-payments',
    heading: 'Failed and duplicate payments',
    blocks: [
      {
        p: 'If a payment fails, we retry it and email you. Your plan stays active during a short grace period; if it still has not cleared after that, the account moves to read-only until you update your payment method. Nothing is lost.',
      },
      {
        p: 'If money left your account but the payment shows as failed on ours, it is usually an authorisation that will be released by your bank within 5 to 7 working days. Send us the reference at {{EMAIL}} and we will confirm what happened.',
      },
    ],
  },
  {
    id: 'how-to-request',
    heading: 'How to request a refund',
    blocks: [
      {
        p: 'Email {{EMAIL}} from the address on the account, with the invoice number or payment reference and a line about what went wrong. You do not need a form.',
      },
      {
        ul: [
          'We acknowledge refund requests within 2 working days.',
          'Approved refunds are issued to the original payment method within 7 to 10 working days, and how quickly it appears then depends on your bank.',
          'If we decline a request we will tell you why, in writing, and point to the clause we relied on.',
        ],
      },
    ],
  },
  {
    id: 'chargebacks',
    heading: 'Chargebacks',
    blocks: [
      {
        p: 'Please talk to us before raising a chargeback with your bank — it is slower for you than emailing us, and it is usually a misunderstanding we can resolve the same day. While a chargeback is open we may suspend the account until it is settled. If a chargeback is decided in our favour, we may recover the associated bank fees before restoring access.',
      },
    ],
  },
  {
    id: 'contact',
    heading: 'Contact',
    blocks: [
      {
        p: 'Billing questions, cancellations and refunds: {{EMAIL}}, or {{PHONE}} during business hours. Postal address: {{COMPANY}}, {{ADDRESS}}.',
      },
    ],
  },
];

export default function Lp2RefundsPage() {
  return (
    <LegalPage
      title="Cancellation & Refunds"
      hue="tangerine"
      updated="25 July 2026"
      intro="Cancel yourself in two clicks, keep what you paid for until the period ends, and here — in plain words — is exactly when money comes back."
      sections={SECTIONS}
    />
  );
}
