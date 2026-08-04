import type { Metadata } from 'next';

import { LegalPage, type LegalSection } from '@/components/lp2/legal';

// Every control claimed here is one the codebase actually implements —
// row-level security on the tenant tables, AES-256-GCM on stored
// credentials, HMAC verification on inbound Meta webhooks, signed
// outbound webhooks. A security page that claims certifications we do
// not hold or controls we have not built is a liability in a breach,
// so the "what we do not claim" section stays until it is untrue.
export const metadata: Metadata = {
  title: { absolute: 'Security Policy — wacrm' },
  description:
    'How wacrm protects your data — encryption, tenant isolation, access control, credential handling, webhook verification, backups, incident response and vulnerability reporting.',
  robots: { index: true, follow: true },
};

const SECTIONS: LegalSection[] = [
  {
    id: 'overview',
    heading: 'What we protect and how to read this',
    blocks: [
      {
        p: 'wacrm holds conversations between businesses and their customers — phone numbers, message content, attachments and the access tokens that let us send on your behalf. A compromise would matter, so this page describes the controls we actually operate rather than the ones that sound reassuring.',
      },
      {
        p: 'It covers the Service operated by {{COMPANY}}. Security is shared: we secure the platform, and you secure your account, your team’s access and the credentials you connect. The sections below say which is which.',
      },
    ],
  },
  {
    id: 'encryption',
    heading: 'Encryption',
    blocks: [
      {
        ul: [
          'In transit — all traffic to the application and its APIs is served over HTTPS with TLS. Connections between our application and our database provider are encrypted.',
          'At rest — workspace data is stored on encrypted volumes by our database and storage provider.',
          'Credentials get a second layer. WhatsApp access tokens, Meta Page tokens, Instagram tokens and your bring-your-own AI provider keys are encrypted with AES-256-GCM under a key held only in our server environment, before they are written to the database. A database dump without that key does not yield working tokens.',
          'Passwords are never stored in a recoverable form. Authentication is handled by our auth provider, which stores a salted hash.',
        ],
      },
      {
        note: 'AES-256-GCM is authenticated encryption: a tampered ciphertext fails to decrypt rather than decrypting to something wrong. Rotating the key deliberately orphans previously encrypted tokens — they must be reconnected, not silently recovered.',
      },
    ],
  },
  {
    id: 'isolation',
    heading: 'Tenant isolation',
    blocks: [
      {
        p: 'Every workspace’s data is separated at the database layer, not just in application code. PostgreSQL row-level security is enabled on the tenant tables, and the policies scope each row to the account that owns it, so a query cannot return another workspace’s rows even if application logic is wrong.',
      },
      {
        ul: [
          'Client-side database access runs under the signed-in user’s identity, subject to those policies.',
          'A privileged service credential exists for server-side work that legitimately spans the policy layer — inbound webhooks and the automation engine. It is confined to server routes, never exposed to the browser, and never shipped in client code.',
          'Uploaded media and avatars are stored in scoped buckets with per-account paths.',
        ],
      },
    ],
  },
  {
    id: 'access-control',
    heading: 'Access control',
    blocks: [
      {
        ul: [
          'Roles and permissions inside a workspace govern who can read conversations, send messages, run campaigns and change settings. Sensitive surfaces — channel connections, billing, API keys — are restricted to owners and admins.',
          'One account per email address, with a password policy enforced at sign-up and reset.',
          'Optional Google sign-in, so teams that manage identity centrally can keep doing so.',
          'Active sessions and devices are listed in Profile settings and can be revoked individually.',
          'API keys are issued per workspace, are shown once at creation, and can be revoked at any time.',
          'Back-office access for our operators is limited to an explicit allow-list of email addresses. Nobody outside it can reach cross-tenant tooling, and the list is kept as short as the work allows.',
          'Our staff access customer data only where necessary to run the Service or to resolve a support request you have raised.',
        ],
      },
    ],
  },
  {
    id: 'integrations',
    heading: 'Channel and integration security',
    blocks: [
      {
        ul: [
          'Every inbound webhook from Meta is verified against an HMAC-SHA256 signature computed with our Meta app secret. Unsigned or mis-signed requests are rejected before any data is read — without that secret configured, the endpoint rejects everything.',
          'Channel connections use official OAuth flows — Meta Embedded Signup for WhatsApp and Facebook Login for Business for Instagram and Messenger. We receive scoped tokens; we never ask for, and never want, your Facebook or WhatsApp password.',
          'Outbound webhooks to your systems are signed with a per-endpoint secret, so your backend can verify a delivery genuinely came from us rather than trusting the payload.',
          'Bring-your-own AI keys are encrypted at rest and used only to generate replies for your workspace. Where AI features are off, no message content reaches a model provider at all.',
          'The hostnames we are willing to publish in invitation links can be pinned by configuration, so a spoofed Host header cannot turn an invite into a phishing link.',
        ],
      },
    ],
  },
  {
    id: 'operations',
    heading: 'Infrastructure and operations',
    blocks: [
      {
        ul: [
          'The application runs on {{HOSTING}}, with workspace data hosted in Mumbai, India (ap-south-1).',
          'Secrets live in the deployment environment, never in the repository.',
          'Dependencies are pinned and updated, with version overrides applied where a transitive package needs patching ahead of its parent.',
          'Changes are reviewed and typechecked before release, and the schema is versioned as migrations rather than applied by hand.',
          'Managed database backups run on our provider’s schedule with point-in-time recovery available on supported plans. Restores are to a point in time, not a per-record undo.',
          'Application and access logging supports investigation of suspicious activity. Logs are retained for a limited period and access to them is restricted.',
        ],
      },
    ],
  },
  {
    id: 'incidents',
    heading: 'Incident response',
    blocks: [
      {
        ul: [
          'We triage suspected incidents on discovery, contain first, then investigate scope and root cause.',
          'Where a personal data breach affects data we process for you, we notify you without undue delay and in any event within 72 hours of becoming aware, with the detail set out in our Data Processing Agreement.',
          'We tell you what we know when we know it, in phases if necessary, rather than waiting for a complete picture.',
          'After the fact we fix the root cause and, where the lesson is useful, the class of problem rather than only the instance.',
        ],
      },
    ],
  },
  {
    id: 'your-part',
    heading: 'Your side of the bargain',
    blocks: [
      {
        ul: [
          'Use a strong, unique password, and enable Google sign-in or your own SSO where you can.',
          'Invite people with the lowest role that lets them do their job, and remove leavers the day they leave.',
          'Treat API keys and webhook secrets like passwords — never commit them, never paste them into a shared document, rotate them if exposed.',
          'Review active sessions periodically and revoke ones you do not recognise.',
          'Keep your Meta Business account secure, including two-factor authentication on the accounts that administer your WhatsApp number.',
          'Tell us immediately at {{SECURITY_EMAIL}} if you believe an account has been compromised.',
        ],
      },
    ],
  },
  {
    id: 'disclosure',
    heading: 'Reporting a vulnerability',
    blocks: [
      {
        p: 'If you have found a security issue, we want to hear about it. Email {{SECURITY_EMAIL}} with enough detail to reproduce it — affected URL or endpoint, steps, and what you were able to access. We will acknowledge, investigate, keep you updated, and credit you if you would like that.',
      },
      {
        ul: [
          'Please give us a reasonable opportunity to fix an issue before disclosing it publicly.',
          'Test only against your own account and data. Do not access, modify or exfiltrate another customer’s data — if a flaw would let you, stop and tell us instead of proving it.',
          'No denial-of-service testing, no social engineering of our staff or customers, no physical attacks, and no automated scanning that degrades the Service for others.',
          'We will not pursue legal action over good-faith research that follows these rules.',
        ],
      },
    ],
  },
  {
    id: 'not-claimed',
    heading: 'What we do not claim',
    blocks: [
      {
        p: 'A security page is more useful when it is honest about its edges, and claiming a certification we do not hold would be worse than useless in an incident.',
      },
      {
        ul: [
          'We do not currently claim SOC 2, ISO 27001 or PCI DSS certification. Card payments are handled entirely by our payment processor, which holds its own compliance — we never receive or store card details.',
          'No system is perfectly secure, and no provider can honestly promise otherwise.',
          'Messages on the WhatsApp Business Platform are not end-to-end encrypted in the way personal WhatsApp chats are. By design, a business API message is readable by the business and its platform — that is what makes a shared team inbox possible, and it is worth understanding before you send anything sensitive over it.',
          'We cannot secure what happens after data leaves the Service — an export you download, or a system you forward it to, is yours to protect.',
        ],
      },
      {
        p: 'If your procurement process needs a security questionnaire completed or current documentation shared, email {{SECURITY_EMAIL}} and we will work through it.',
      },
    ],
  },
];

export default function Lp2SecurityPolicyPage() {
  return (
    <LegalPage
      title="Security Policy"
      hue="sky"
      updated="5 August 2026"
      intro="The controls we actually operate — encryption, database-level tenant isolation, least-privilege access and signed webhooks — plus an honest account of what we do not claim."
      sections={SECTIONS}
    />
  );
}
