import {
  Building2,
  Cloud,
  Code2,
  Hash,
  Mail,
  Puzzle,
  Sheet,
  ShoppingBag,
  ShoppingCart,
  Webhook,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react';

// ============================================================
// Integrations "app store" — a grid of everything Instant can wire into,
// grouped by how you actually connect it:
//
//   • Built in    — native surfaces that live in this app (API keys, the
//                   webhooks panel right below this grid).
//   • Automation  — Zapier / Make / n8n, which reach the REST API and
//                   webhooks and fan out to thousands of apps.
//   • Popular apps — reached THROUGH those automation platforms today, so
//                   their card is honest: it points at the setup guide,
//                   not a native OAuth flow we don't have yet.
//
// Every CTA goes somewhere real: a settings page, the webhooks panel
// anchor, or the /docs/api-and-integrations guide. No dead buttons.
// ============================================================

export type Group = 'builtin' | 'platform' | 'app';

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Icon-tile colour. Light-app tokens with a dark: text fallback, to
   *  match the rest of the settings surface. */
  tone: string;
  group: Group;
  /** Where the CTA points. `#webhooks` scrolls to the panel below. */
  href: string;
  external?: boolean;
  cta: string;
  /** Brand artwork, where we have it. The rest draw `icon` on `tone`. */
  logo?: string;
}

/**
 * What a connect component hands the integration page's card: its
 * connection state, and a way to open its own connect / manage dialog.
 * The page draws the card; the component keeps the dialog and the logic.
 */
export interface ConnectCardArgs {
  connected: boolean;
  /** Still reading the connection status. */
  loading: boolean;
  open: () => void;
}

/** How an integration's page connects it. */
export type ConnectKind =
  /** A connection of our own: a dialog, credentials, a live status. */
  | 'native'
  /** Zapier itself: the in-app setup guide. */
  | 'zapier'
  /** An app reached through Zapier today; the page says so. */
  | 'via-zapier'
  /** An automation platform wired up from its own side (Make, n8n):
   *  the setup guide in the docs. */
  | 'docs'
  /** The outbound-webhooks settings, shown on the page itself. */
  | 'panel';

const NATIVE = new Set(['shopify', 'woocommerce', 'zoho-crm', 'google-sheets']);
const DOCS = new Set(['make', 'n8n']);

export function connectKind(id: string): ConnectKind {
  if (id === 'webhooks') return 'panel';
  if (id === 'zapier') return 'zapier';
  if (NATIVE.has(id)) return 'native';
  return DOCS.has(id) ? 'docs' : 'via-zapier';
}

/** The one integrations guide every page's "Go to documentation" opens. */
export const INTEGRATIONS_DOCS_HREF = '/docs/api-and-integrations';

export const INTEGRATIONS: Integration[] = [
  // ── Built in ──────────────────────────────────────────────────────
  {
    id: 'rest-api',
    name: 'REST API',
    description:
      'Generate API keys and call Instant from your own backend — contacts, messages, campaigns and more.',
    icon: Code2,
    tone: 'bg-primary/10 text-primary',
    group: 'builtin',
    href: '/settings/api-access',
    cta: 'Set up keys',
  },
  {
    id: 'webhooks',
    name: 'Outbound webhooks',
    description:
      'Push real-time events (new message, inbound reply, deal moved…) to any URL you own.',
    icon: Webhook,
    tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    group: 'builtin',
    href: '#webhooks',
    cta: 'Configure',
  },
  // ── Automation platforms ──────────────────────────────────────────
  {
    // Rendered by <ZapierConnect>, which opens the setup guide in a
    // dialog — so `icon`, `tone`, `href` and `cta` below go unused for
    // this one. The entry stays because the grid builds its groups
    // from this catalog.
    id: 'zapier',
    name: 'Zapier',
    description:
      'Connect Instant to 6,000+ apps with no code, using your API key and webhooks.',
    icon: Zap,
    tone: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    group: 'platform',
    href: '/docs/api-and-integrations',
    cta: 'Setup guide',
  },
  {
    id: 'make',
    name: 'Make',
    description:
      'Build multi-step scenarios visually and trigger them from Instant events.',
    icon: Workflow,
    tone: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400',
    group: 'platform',
    href: '/docs/api-and-integrations',
    cta: 'Setup guide',
  },
  {
    id: 'n8n',
    name: 'n8n',
    description:
      'Self-host your automations and wire Instant in through the REST API and webhooks.',
    icon: Puzzle,
    tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    group: 'platform',
    href: '/docs/api-and-integrations',
    cta: 'Setup guide',
  },
  // ── Popular apps (via automation) ─────────────────────────────────
  {
    // Native since migration 106: Instant creates a spreadsheet in the
    // customer's Drive and writes to it directly. Its card links to its
    // page, where the connect flow lives.
    id: 'google-sheets',
    name: 'Google Sheets',
    description:
      'Send new contacts, messages, assignments, deal changes or campaign results to spreadsheets in your Google Drive.',
    icon: Sheet,
    tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    group: 'builtin',
    href: '/settings/integrations/google-sheets',
    cta: 'Connect',
    // Served from public/ rather than the media host the other logos use.
    logo: '/images/integrations/google-sheets.webp',
  },
  {
    // Native connect flow (rendered by <ZohoConnect>). Moved out of the
    // "via Zapier" group when it got one — and into `builtin` with the
    // other real connections, since a card that says "Connect" beside
    // cards that say "Connect via Zapier" would otherwise be lost in
    // the wrong section.
    id: 'zoho-crm',
    name: 'Zoho CRM',
    description: 'Let Zoho events — a deal stage change, a new lead — send WhatsApp messages.',
    icon: Building2,
    tone: 'bg-red-500/10 text-red-600 dark:text-red-400',
    group: 'builtin',
    href: '#',
    cta: 'Connect',
    // The four-square mark alone, where the media host carries the
    // full lockup — mark PLUS the word ZOHO. That matters because the
    // grid contains every logo in a square 40px box: the lockup fits
    // to 40px of WIDTH, and the squares, being a third of it, come out
    // about 14px across. The mark on its own gets the full 40 and the
    // name is already printed under the card.
    //
    // Trimmed to its bounding box first — the supplied file kept the
    // lockup canvas, so a quarter of its height was the empty strip
    // where the wordmark used to be, and object-contain would have
    // scaled the mark down to fit that too.
    //
    // Served from public/ for the same reason Google Sheets is.
    logo: '/images/integrations/zoho-crm.png',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Create and update HubSpot contacts and deals from Instant activity.',
    icon: Building2,
    tone: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    group: 'app',
    href: '/docs/api-and-integrations',
    cta: 'Connect via Zapier',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Push leads and conversation events into your Salesforce org.',
    icon: Cloud,
    tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    group: 'app',
    href: '/docs/api-and-integrations',
    cta: 'Connect via Zapier',
  },
  {
    // Native connect flow (rendered by <ShopifyConnect>).
    id: 'shopify',
    name: 'Shopify',
    description: 'New orders create contacts and fire a Shopify automation.',
    icon: ShoppingBag,
    tone: 'bg-green-500/10 text-green-600 dark:text-green-400',
    group: 'builtin',
    href: '#',
    cta: 'Connect',
    logo: 'https://media.instant.nebkern.com/assets/shopify-logo.png',
  },
  {
    // Native connect flow (rendered by <WooCommerceConnect>, not the
    // generic card) — kept in the data set so its group placement and
    // ordering live here with everything else.
    id: 'woocommerce',
    name: 'WooCommerce',
    description: 'New orders create contacts and fire a WooCommerce automation.',
    icon: ShoppingCart,
    tone: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    group: 'builtin',
    href: '#',
    cta: 'Connect',
    logo: 'https://media.instant.nebkern.com/assets/woocommerce-logo.png',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get notified in a Slack channel when a new conversation comes in.',
    icon: Hash,
    tone: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    group: 'app',
    href: '/docs/api-and-integrations',
    cta: 'Connect via Zapier',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Email your team when a lead replies, or log conversations to a thread.',
    icon: Mail,
    tone: 'bg-red-500/10 text-red-600 dark:text-red-400',
    group: 'app',
    href: '/docs/api-and-integrations',
    cta: 'Connect via Zapier',
  },
];

export const GROUPS: { id: Group; title: string; blurb: string }[] = [
  {
    id: 'builtin',
    title: 'Built in',
    blurb: 'Native to Instant — set up right here.',
  },
  {
    id: 'platform',
    title: 'Automation platforms',
    blurb: 'Connect thousands of apps with no code.',
  },
  {
    id: 'app',
    title: 'Popular apps',
    blurb: 'Connected today through Zapier, Make or n8n.',
  },
];

/** An integration's own page. REST API's is the API access section. */
export function integrationHref(id: string): string {
  return id === 'rest-api' ? '/settings/api-access' : '/settings/integrations/' + id;
}

/**
 * One settings-rail row per integration, in the order the grid shows
 * them (by group, then catalog order). REST API is left out: it has a
 * page of its own, which the rail already lists as "API access".
 */
export const INTEGRATION_RAIL_LINKS = GROUPS.flatMap((g) =>
  INTEGRATIONS.filter((i) => i.group === g.id && i.id !== 'rest-api'),
).map((i) => ({ id: i.id, label: i.name, href: integrationHref(i.id) }));
