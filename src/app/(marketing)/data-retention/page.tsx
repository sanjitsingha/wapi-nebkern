import type { Metadata } from 'next';

import { LegalPage, type LegalSection } from '@/components/lp2/legal';

// Deliberately concrete about timings, because a retention policy made
// of "as long as necessary" tells nobody anything. Also honest that
// closing an account is a request to us rather than a self-serve button
// — the app has no customer-facing account-deletion endpoint today, and
// promising one on a legal page would be a promise we'd break.
export const metadata: Metadata = {
  alternates: { canonical: '/data-retention' },
  title: { absolute: 'Data Retention & Deletion — Instant for WhatsApp Business' },
  description:
    'How long Instant keeps each kind of data, what happens when you delete a record or close an account, backup expiry, and what we must retain by law.',
  robots: { index: true, follow: true },
};

const SECTIONS: LegalSection[] = [
  {
    id: 'principles',
    heading: 'The principle',
    blocks: [
      {
        p: 'We keep personal data for as long as it is needed for the purpose it was collected for, and then we delete it. For the conversations and contacts inside your workspace, "needed" is a decision you make, not us: you are the controller, and the data stays as long as your account is active and you choose to keep it.',
      },
      {
        p: 'This policy sets out the periods we apply, what deletion actually means technically, and the narrow set of records we are required to hold on to. It forms part of our Data Processing Agreement and applies to {{PRODUCT}}, operated by {{COMPANY}}.',
      },
    ],
  },
  {
    id: 'active-account',
    heading: 'While your account is active',
    blocks: [
      {
        ul: [
          'Conversations, contacts, notes, tags, custom fields, deals and call records — kept until you delete them or close the account. We do not age them out or archive them behind your back.',
          'Message attachments and voice notes — kept alongside the conversation they belong to, on the same basis.',
          'Account and team member records — kept while the workspace exists. Removing a member revokes their access immediately; their name remains on the messages and notes they authored, because rewriting conversation history would be worse than keeping it.',
          'Session and device records — kept while the session is valid, and for a short period afterwards for security investigation. You can revoke any session yourself from Profile settings.',
          'Application and access logs — retained for a limited period, typically no more than 90 days, then discarded.',
          'Channel access tokens — held encrypted for as long as the channel is connected, and deleted immediately when you disconnect it in Settings.',
        ],
      },
      {
        note: 'Deleting a contact in the app deletes their record and associated conversation data from the live database. It does not reach into backups — see the backup section below.',
      },
    ],
  },
  {
    id: 'closing',
    heading: 'Deleting your account',
    blocks: [
      {
        p: 'The account owner can delete the workspace at any time from Settings → Profile → Delete account. If you cannot use the app, email {{EMAIL}} from the address that owns the workspace; we verify the request comes from someone entitled to make it before acting, which protects your business from someone else deleting its records.',
      },
      {
        ol: [
          'The account is locked immediately, and the owner is emailed a confirmation.',
          'For 30 days the account can be restored from {{SITE}}/account-recovery — in case the request was a mistake, or a departing employee acted without authority.',
          'When the 30 days end, all workspace data — contacts, conversations, media, templates, connected channels and their access tokens, and data received from Meta and Google — is permanently deleted from our live systems.',
          'Backups containing it expire on their normal rotation within 30 days, and are not selectively edited — see below.',
        ],
      },
      {
        note: 'Export your data before you delete the account. Contacts, conversations and reports can be exported from the app while it is open. Once deletion completes we cannot recover it for you, and neither can our providers. Step-by-step instructions are on our Data Deletion page.',
      },
    ],
  },
  {
    id: 'inactive',
    heading: 'Lapsed and inactive accounts',
    blocks: [
      {
        ul: [
          'When a subscription lapses, data is retained rather than deleted — people come back, and deleting a paying customer’s history over a failed card would be indefensible.',
          'We may restrict access to an unpaid workspace while retaining its contents.',
          'Where an account has been inactive and unpaid for an extended period, we may delete it after giving notice to the registered email address and a reasonable opportunity to export or reactivate.',
          'Accounts that never completed sign-up, and workspaces with no data, may be removed without notice.',
        ],
      },
    ],
  },
  {
    id: 'backups',
    heading: 'Backups, and what deletion cannot reach',
    blocks: [
      {
        p: 'Our database provider takes managed backups so that a failure or a mistake does not destroy your business. Those backups are point-in-time snapshots of whole databases, and they cannot be edited to surgically remove one record — trying to would compromise their integrity as a recovery mechanism.',
      },
      {
        ul: [
          'Deleted data may persist in backups until they expire on their normal rotation, typically within 30 days.',
          'Backups are encrypted, access to them is restricted, and they are used only to restore the Service.',
          'If a backup is ever restored, we re-apply outstanding deletions afterwards so that deleted data does not quietly return.',
        ],
      },
    ],
  },
  {
    id: 'required',
    heading: 'What we keep regardless, and why',
    blocks: [
      {
        p: 'A few categories survive account closure because the law or a legitimate interest requires it. Each is limited to what is necessary and no more.',
      },
      {
        ul: [
          'Invoices, payment records and tax documents — retained for the period our tax and accounting law requires, commonly up to eight years. These identify the business and the transaction, not your customers’ conversations.',
          'Records needed to establish, exercise or defend a legal claim, for as long as that claim is live or possible.',
          'Minimal abuse and fraud records — for example that a particular email address or number was terminated for a policy breach — kept so a banned account cannot simply be reopened. Retained no longer than necessary for that purpose.',
          'Aggregated or de-identified usage statistics, which no longer identify anyone and are not restored to an identifiable state.',
        ],
      },
    ],
  },
  {
    id: 'third-parties',
    heading: 'Data held by others',
    blocks: [
      {
        p: 'Deleting your Instant workspace does not delete copies held elsewhere, and we cannot make it:',
      },
      {
        ul: [
          'Meta retains message data on the WhatsApp Business Platform, Instagram and Messenger under its own terms and retention schedule. Requests about that go to Meta.',
          'Our payment processor retains transaction records under its own regulatory obligations.',
          'Anything you exported, or that your webhooks and API integrations delivered to your own systems, is under your control and yours to delete.',
          'Your contacts’ own copies of the messages remain on their phones, as they would with any messaging app.',
        ],
      },
    ],
  },
  {
    id: 'requests',
    heading: 'Deletion requests from your customers',
    blocks: [
      {
        p: 'If one of your contacts asks to be erased, that request is yours to answer — you are the controller and you know whether another basis for keeping the record applies. The app lets you find, export and delete any contact and their conversation history directly.',
      },
      {
        p: 'If someone contacts us directly about data we hold for one of our customers, we will not act on it unilaterally. We will point them to the business concerned and let that business know. Where you need help fulfilling a request that the product does not cover, email {{EMAIL}} and we will assist.',
      },
    ],
  },
];

export default function Lp2DataRetentionPage() {
  return (
    <LegalPage
      title="Data Retention & Deletion Policy"
      hue="tangerine"
      updated="14 October 2026"
      intro="How long each category of data survives, what happens when you delete a record or close an account, why backups take a little longer, and the short list of things we have to keep."
      sections={SECTIONS}
    />
  );
}
