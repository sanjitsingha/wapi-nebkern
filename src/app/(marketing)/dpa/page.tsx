import type { Metadata } from 'next';

import { LegalPage, type LegalSection } from '@/components/lp2/legal';

// The contract term, not a summary of one. A DPA is what a GDPR-exposed
// buyer's procurement team asks for by name, and it has required
// content: subject matter, duration, nature and purpose, categories of
// data and data subjects, and the Article 28(3) processor obligations.
// Written to be signable — hence the "how to execute" section, which is
// the part most template DPAs forget.
export const metadata: Metadata = {
  title: { absolute: 'Data Processing Agreement — wacrm' },
  description:
    'The wacrm Data Processing Agreement — processor obligations, subprocessors, international transfers, security, breach notification, audit rights and deletion on termination.',
  robots: { index: true, follow: true },
};

const SECTIONS: LegalSection[] = [
  {
    id: 'parties',
    heading: 'Parties and how this applies',
    blocks: [
      {
        p: 'This Data Processing Agreement ("DPA") is between you, the customer named on the wacrm account ("Controller"), and {{COMPANY}}, registered at {{ADDRESS}} ("Processor", "we"). It forms part of and is governed by our Terms of Service (the "Agreement"). Where this DPA and the Terms conflict on the processing of personal data, this DPA wins.',
      },
      {
        p: 'It applies automatically from the moment you accept the Terms and process personal data through the Service — no signature is required for it to bind us. If your procurement process needs a countersigned copy, see the last section.',
      },
      {
        p: 'Terms such as "personal data", "processing", "controller", "processor", "data subject" and "supervisory authority" carry the meaning given to them in the applicable data protection law — including the EU and UK GDPR and India’s Digital Personal Data Protection Act, 2023.',
      },
    ],
  },
  {
    id: 'roles',
    heading: 'Roles: who is controller, who is processor',
    blocks: [
      {
        ul: [
          'For your customers’ data — the contacts, phone numbers, messages, attachments, notes, tags and call records inside your workspace — you are the Controller and we are the Processor. You decide who is contacted, on what lawful basis, and for how long records are kept.',
          'For your own account, billing, security and product-usage data, we act as Controller, and our Privacy Policy governs it rather than this DPA.',
          'Meta acts as an independent controller for the message data that necessarily passes through the WhatsApp Business Platform, Instagram and Messenger, under its own terms. We cannot contract that away on Meta’s behalf.',
        ],
      },
      {
        p: 'You warrant that you have a lawful basis for the processing you instruct, that you have given data subjects the notices they are owed, and that you have obtained any consent required — including the WhatsApp opt-in described in our Acceptable Use and WhatsApp Marketing policies.',
      },
    ],
  },
  {
    id: 'particulars',
    heading: 'Subject matter and details of processing',
    blocks: [
      {
        p: 'Required by Article 28(3) and its equivalents. These are the particulars of what we process for you:',
      },
      {
        ul: [
          'Subject matter — provision of the wacrm customer-relationship platform for messaging channels.',
          'Duration — for as long as your account is active, plus the deletion windows in our Data Retention & Deletion Policy.',
          'Nature and purpose — receiving, sending, storing, organising, retrieving, displaying and deleting messages and contact records; running automations, campaigns and AI agents you configure; providing support you request.',
          'Categories of personal data — names, phone numbers, WhatsApp/Instagram/Messenger identifiers, profile photos, message content and attachments, voice notes and call metadata, notes, tags, custom fields, deal and pipeline data, and anything else you or your contacts put into a conversation.',
          'Categories of data subjects — your customers and prospects, and your own team members who use the workspace.',
          'Special categories — not requested by us and not required by the Service. If health, biometric or similar data ends up in a conversation, we process it only incidentally, as part of storing your messages.',
        ],
      },
    ],
  },
  {
    id: 'our-obligations',
    heading: 'Our obligations as Processor',
    blocks: [
      { p: 'We will:' },
      {
        ul: [
          'Process personal data only on your documented instructions — the Agreement, this DPA, the settings you choose in the product, and any further written instruction we accept — unless required otherwise by law, in which case we will tell you first unless the law forbids it.',
          'Tell you if, in our opinion, an instruction infringes applicable data protection law.',
          'Ensure that everyone authorised to process the data is bound by confidentiality and has been trained on handling it.',
          'Implement and maintain the technical and organisational measures described in our Security Policy, and not materially weaken them during the term.',
          'Assist you, taking into account the nature of the processing, with data subject requests, data protection impact assessments and prior consultations with a supervisory authority.',
          'Make available the information reasonably necessary to demonstrate compliance with this DPA.',
          'Never sell personal data, never share it for cross-context behavioural advertising, and never use the contents of your conversations to train general-purpose AI models.',
        ],
      },
      {
        note: 'The last point is a contractual commitment, not a marketing line. Your AI agent is grounded on the knowledge base you upload and operates only inside your workspace.',
      },
    ],
  },
  {
    id: 'subprocessors',
    heading: 'Subprocessors',
    blocks: [
      {
        p: 'You give us general written authorisation to engage subprocessors. The current list — who they are, what they do and where they operate — is published on our Subprocessor List and forms part of this DPA.',
      },
      {
        ul: [
          'Each subprocessor is engaged under a written contract imposing data protection obligations no less protective than these.',
          'We remain fully liable to you for a subprocessor’s performance of those obligations.',
          'We will give you reasonable notice before adding or replacing a subprocessor, so you have time to object.',
          'If you reasonably object on data protection grounds, tell us in writing within 30 days. We will work with you on a solution; if none is workable, you may terminate the affected part of the Service and receive a pro-rata refund of prepaid fees.',
        ],
      },
    ],
  },
  {
    id: 'transfers',
    heading: 'International transfers',
    blocks: [
      {
        p: 'Your workspace data is hosted in {{REGION}}. Some subprocessors operate globally, so personal data may be transferred outside your country — including outside the EEA, the UK or India.',
      },
      {
        ul: [
          'Where a transfer requires a safeguard, we rely on an adequacy decision where one exists, and otherwise on the European Commission’s Standard Contractual Clauses, the UK International Data Transfer Addendum, or another lawful mechanism.',
          'By entering into this DPA, the parties are deemed to have entered into the applicable Standard Contractual Clauses, with you as data exporter and us as data importer, completed by reference to the particulars set out above.',
          'We will not transfer personal data to a country without a lawful transfer mechanism in place.',
        ],
      },
    ],
  },
  {
    id: 'security-breach',
    heading: 'Security and personal data breaches',
    blocks: [
      {
        p: 'Our technical and organisational measures are set out in full in our Security Policy — encryption in transit and at rest, tenant isolation enforced at the database, least-privilege access, credential encryption, logging and backups.',
      },
      {
        ul: [
          'We will notify you without undue delay, and in any event within 72 hours, after becoming aware of a personal data breach affecting your data.',
          'The notice will describe the nature of the breach, the categories and approximate volume of data and data subjects affected, the likely consequences, and the measures taken or proposed.',
          'Where we cannot provide all of that at once, we will provide it in phases as the investigation progresses rather than delaying the first notice.',
          'We will assist you in meeting your own notification duties to supervisory authorities and data subjects.',
          'Notifying you is not an admission of fault by either party.',
        ],
      },
    ],
  },
  {
    id: 'data-subject-rights',
    heading: 'Data subject requests',
    blocks: [
      {
        p: 'Requests from your customers — access, correction, erasure, portability, objection — are yours to answer, because you are the Controller and you know the context. The Service is built so you can answer them yourself: every contact record can be searched, exported and deleted from the app.',
      },
      {
        p: 'If a data subject contacts us directly about data we hold for you, we will not respond substantively. We will tell them to contact you, and let you know it happened. Where you need more than the product provides, we will give reasonable assistance, and we will not charge for a proportionate amount of it.',
      },
    ],
  },
  {
    id: 'audit',
    heading: 'Audit and compliance evidence',
    blocks: [
      {
        ul: [
          'On reasonable written request, and no more than once a year unless a regulator or a breach requires otherwise, we will provide the information needed to demonstrate compliance with this DPA.',
          'We will first offer our current security documentation and any third-party reports or certifications we hold — for most audits that is sufficient and far less disruptive.',
          'Where that genuinely does not satisfy a legal requirement, we will permit an audit by you or an independent auditor bound by confidentiality, on at least 30 days’ notice, during business hours, without unreasonable disruption to the Service and without access to other customers’ data.',
          'You bear the cost of an audit unless it reveals a material breach of this DPA by us.',
        ],
      },
    ],
  },
  {
    id: 'deletion',
    heading: 'Return and deletion',
    blocks: [
      {
        p: 'On termination or expiry, we delete or return personal data processed for you, at your choice, and delete existing copies unless law requires us to keep them. Export your data before you close the account — the app provides it, and after the deletion window it is gone.',
      },
      {
        p: 'Exact timings, the grace period, backup expiry and the narrow categories we must retain for tax and fraud purposes are set out in our Data Retention & Deletion Policy, which forms part of this DPA.',
      },
    ],
  },
  {
    id: 'liability-execution',
    heading: 'Liability, term and how to execute this',
    blocks: [
      {
        ul: [
          'Each party’s liability under this DPA is subject to the limitations and exclusions in the Agreement.',
          'This DPA takes effect when you accept the Terms and continues until we no longer process personal data for you.',
          'We may update it to reflect a change in law, a new safeguard or a change in our processing. Material changes will be notified in advance, and continuing to use the Service after they take effect is acceptance.',
          'It is governed by the law and jurisdiction stated in the Agreement, except where applicable data protection law requires otherwise.',
        ],
      },
      {
        p: 'If your procurement or compliance process requires a signed, countersigned or entity-specific copy — or a version with the Standard Contractual Clauses annexed and completed — email {{EMAIL}} with your legal entity name, registered address and the name of the signatory. We will send one back.',
      },
    ],
  },
];

export default function Lp2DpaPage() {
  return (
    <LegalPage
      title="Data Processing Agreement"
      hue="grape"
      updated="4 August 2026"
      intro="Most of the personal data in wacrm is not ours — it is your customers', held on your instructions. This is the contract that governs how we handle it, and it applies automatically from the moment you accept our Terms."
      sections={SECTIONS}
    />
  );
}
