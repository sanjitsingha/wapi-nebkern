/**
 * The canonical list of legal documents.
 *
 * One list, two consumers: the footer band and the sidebar on the legal
 * pages themselves. They must agree — a policy that appears in one and
 * not the other is how a document quietly becomes unreachable, and
 * Razorpay's merchant review and Meta's app review both check that these
 * resolve from the public site.
 *
 * Ordered by who reads them: everyday customer terms first, then the
 * WhatsApp-specific rules, then the data-protection set that a
 * procurement or compliance team asks for by name.
 */
export const LEGAL_LINKS: { label: string; href: string }[] = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Cookie Policy', href: '/cookies' },
  { label: 'Refund & Cancellation', href: '/refunds' },
  { label: 'Acceptable Use', href: '/acceptable-use' },
  { label: 'WhatsApp Messaging Policy', href: '/whatsapp-messaging-policy' },
  { label: 'WhatsApp Marketing Policy', href: '/whatsapp-marketing-policy' },
  { label: 'Data Processing Agreement', href: '/dpa' },
  { label: 'Security Policy', href: '/security' },
  { label: 'Subprocessor List', href: '/subprocessors' },
  { label: 'Data Retention & Deletion', href: '/data-retention' },
];
