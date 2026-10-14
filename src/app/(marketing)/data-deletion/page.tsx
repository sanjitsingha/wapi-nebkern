import type { Metadata } from 'next';

import { LegalPage, type LegalSection } from '@/components/lp2/legal';

// The "Data deletion instructions URL" entered in Meta's App Dashboard
// (App settings → Basic). Meta's reviewers open it, so it must stay
// public, indexed, and true to the product: the menu paths below are
// the app's real ones (Settings → Profile → Delete account, owner only;
// Settings → WhatsApp / Instagram / Messenger → Disconnect), the window
// is DELETION_WINDOW_DAYS (30) and recovery lives at /account-recovery.
export const metadata: Metadata = {
  alternates: { canonical: '/data-deletion' },
  title: { absolute: 'Data Deletion Instructions — Instant for WhatsApp Business' },
  description:
    'How to delete your Instant account, your WhatsApp, Instagram or Messenger connection and the data received from Meta, or individual contacts — yourself, or by asking us.',
  robots: { index: true, follow: true },
};

const SECTIONS: LegalSection[] = [
  {
    id: 'overview',
    heading: 'Your options at a glance',
    blocks: [
      {
        p: 'You can delete your data from {{PRODUCT}} yourself at any time, or ask us to do it for you. This page explains how to:',
      },
      {
        ul: [
          'Delete your entire {{PRODUCT}} account and all of its data (section 2).',
          'Disconnect a WhatsApp, Instagram or Messenger account and delete the access we hold for it (section 3).',
          'Delete individual contacts and conversations (section 4).',
          'Ask us to delete your data by email (section 5).',
          'Have your data removed if you are a customer of a business that uses {{PRODUCT}} (section 6).',
        ],
      },
    ],
  },
  {
    id: 'delete-account',
    heading: 'Delete your entire account',
    blocks: [
      { p: 'The account owner can delete the whole workspace from inside the app:' },
      {
        ol: [
          'Sign in to {{PRODUCT}} at {{SITE}} as the account owner.',
          'Go to Settings → Profile.',
          'Under "Delete account", choose Delete account and confirm.',
        ],
      },
      {
        p: 'The account is locked immediately and we email the owner a confirmation. For 30 days you can restore it at {{SITE}}/account-recovery, in case the request was a mistake. After 30 days, everything in the workspace is permanently deleted — including all data received from Meta: messages, media, contacts, templates, connected WhatsApp, Instagram and Messenger accounts and their access tokens — together with your team members’ access.',
      },
      {
        note: 'Export anything you want to keep first. After the 30-day window the data cannot be recovered, by you or by us.',
      },
    ],
  },
  {
    id: 'disconnect-meta',
    heading: 'Disconnect WhatsApp, Instagram or Messenger',
    blocks: [
      { p: 'To stop {{PRODUCT}} accessing a Meta account without deleting your whole workspace:' },
      {
        ol: [
          'In {{PRODUCT}}, go to Settings → WhatsApp, Settings → Instagram or Settings → Messenger.',
          'Choose Disconnect and confirm.',
        ],
      },
      {
        p: 'We immediately delete the access token and connection settings for that account, and {{PRODUCT}} can no longer read or send messages through it. Conversation history you already have remains in your workspace until you delete it (section 4) or delete your account (section 2).',
      },
      {
        p: 'You can also remove {{PRODUCT}}’s access from Meta’s side at any time: on Facebook, go to Settings & privacy → Settings → Business integrations and remove {{PRODUCT}}; or, in Meta Business Suite, go to Business settings and remove {{PRODUCT}} from your connected apps.',
      },
    ],
  },
  {
    id: 'delete-records',
    heading: 'Delete individual contacts and conversations',
    blocks: [
      {
        p: 'In {{PRODUCT}}, open Contacts, select the contacts you want to remove and delete them. A contact’s conversations, notes and tags are deleted with them, and are removed from our live systems straight away.',
      },
    ],
  },
  {
    id: 'request',
    heading: 'Ask us to delete your data',
    blocks: [
      {
        p: 'If you cannot use the options above, or want us to handle it, email {{EMAIL}} with the subject "Data deletion request". Please write from the email address on your {{PRODUCT}} account and tell us:',
      },
      {
        ul: [
          'The email address of the {{PRODUCT}} account.',
          'What you want deleted — the whole account, or a specific WhatsApp number, Instagram account or Facebook Page connected to it.',
        ],
      },
      {
        p: 'We verify that the request comes from the account owner, acknowledge it within 2 working days, and complete the deletion within 30 days. We email you a confirmation when it is done.',
      },
    ],
  },
  {
    id: 'end-customers',
    heading: 'If you messaged a business that uses Instant',
    blocks: [
      {
        p: 'If you chatted with a business on WhatsApp, Instagram or Messenger and that business uses {{PRODUCT}}, the business controls your data and decides what is kept. To have your data deleted, ask that business directly.',
      },
      {
        p: 'You can also email {{EMAIL}} with the business’s name and your phone number or account name. We will pass your request to the business and help it act on it. To stop receiving a business’s messages, reply "stop" to it, or block the business in WhatsApp.',
      },
    ],
  },
  {
    id: 'what-remains',
    heading: 'What is kept after deletion',
    blocks: [
      {
        ul: [
          'Encrypted backups — deleted data can remain in backups for up to 30 days, until they expire. Backups are used only to recover from failures.',
          'Invoices and payment records — kept as long as Indian tax and accounting law requires. They identify the business and the payment, not your customers or conversations.',
          'Copies held by others — messages remain on your customers’ phones, Meta keeps its own records under its own terms, and data you exported or sent to other tools is under your control.',
        ],
      },
    ],
  },
  {
    id: 'contact',
    heading: 'Contact',
    blocks: [
      {
        p: 'Questions about deleting your data: {{EMAIL}} or {{PHONE}}. {{COMPANY}}, {{ADDRESS}}. Our Privacy Policy and Data Retention & Deletion Policy have more detail.',
      },
    ],
  },
];

export default function DataDeletionPage() {
  return (
    <LegalPage
      title="Data Deletion Instructions"
      hue="sky"
      updated="14 October 2026"
      intro="How to delete your Instant account, disconnect WhatsApp, Instagram or Messenger, or remove individual records — yourself in a few clicks, or by asking us."
      sections={SECTIONS}
    />
  );
}
