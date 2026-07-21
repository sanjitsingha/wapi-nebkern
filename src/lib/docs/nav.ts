import {
  AtSign,
  Bot,
  FileText,
  Filter,
  GitBranch,
  Headset,
  ImageIcon,
  KeyRound,
  MessageSquare,
  Rocket,
  Settings,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Docs information architecture — one flat list of categories, each
 * holding an ordered list of pages. Both the sidebar (docs-shell.tsx)
 * and the index page (docs/page.tsx) render off this single source, so
 * adding a page here is the only step needed to wire it into both.
 */
export interface DocsPage {
  slug: string;
  title: string;
  /** One-line summary shown on the index page's category cards. */
  description: string;
  icon: LucideIcon;
  /** Rendered next to the title wherever it's a live product surface
   *  rather than a documented-but-not-yet-connectable one. */
  badge?: 'Beta' | 'Coming soon';
}

export interface DocsCategory {
  label: string;
  pages: DocsPage[];
}

export const DOCS_NAV: DocsCategory[] = [
  {
    label: 'Getting started',
    pages: [
      {
        slug: 'getting-started',
        title: 'Getting started',
        description: 'Create an account, understand the trial, and send your first message.',
        icon: Rocket,
      },
    ],
  },
  {
    label: 'Channels',
    pages: [
      {
        slug: 'whatsapp',
        title: 'WhatsApp channel',
        description: 'Connect your WhatsApp Business number, catalog, and calling.',
        icon: MessageSquare,
      },
      {
        slug: 'instagram-messenger',
        title: 'Instagram & Messenger',
        description: 'Status of the Instagram and Facebook Messenger channels.',
        icon: AtSign,
        badge: 'Coming soon',
      },
    ],
  },
  {
    label: 'Conversations & CRM',
    pages: [
      {
        slug: 'inbox',
        title: 'Shared inbox',
        description: 'Conversations, assignment, tags, filters, and the 24-hour window.',
        icon: MessageSquare,
      },
      {
        slug: 'contacts',
        title: 'Contacts',
        description: 'Contact fields, custom fields, tags, and duplicate handling.',
        icon: Users,
      },
      {
        slug: 'segments-and-lists',
        title: 'Segments & lists',
        description: 'Dynamic rule-based segments versus static, manually built lists.',
        icon: Filter,
      },
      {
        slug: 'pipelines',
        title: 'Pipelines & deals',
        description: 'Kanban deal stages, deal value and currency, and the sales CRM.',
        icon: GitBranch,
      },
    ],
  },
  {
    label: 'Growth',
    pages: [
      {
        slug: 'campaigns',
        title: 'Campaigns',
        description: 'Bulk broadcasts on approved templates, targeting, and delivery stats.',
        icon: Rocket,
      },
      {
        slug: 'templates',
        title: 'Message templates',
        description: 'Categories, variables, buttons, and the Meta approval process.',
        icon: FileText,
      },
      {
        slug: 'media',
        title: 'Media library',
        description: 'Uploading and reusing images, video, audio, and documents.',
        icon: ImageIcon,
      },
    ],
  },
  {
    label: 'Automation & AI',
    pages: [
      {
        slug: 'automations',
        title: 'Automations',
        description: 'Trigger → condition → action rules that run without a bot builder.',
        icon: Zap,
      },
      {
        slug: 'flows',
        title: 'Flows',
        description: 'The visual, no-code conversation builder.',
        icon: Bot,
        badge: 'Beta',
      },
      {
        slug: 'ai-agents',
        title: 'AI agents',
        description: 'Knowledge base, playground, auto-reply, and handoff to a human.',
        icon: Bot,
      },
    ],
  },
  {
    label: 'Account',
    pages: [
      {
        slug: 'team',
        title: 'Team members & roles',
        description: 'Inviting teammates, roles, and transferring ownership.',
        icon: Users,
      },
      {
        slug: 'account-settings',
        title: 'Account settings',
        description: 'Profile, security, business profile, and customization.',
        icon: Settings,
      },
      {
        slug: 'billing',
        title: 'Billing & plans',
        description: 'The trial, plan tiers, checkout, activation codes, and invoices.',
        icon: Wallet,
      },
    ],
  },
  {
    label: 'Developers',
    pages: [
      {
        slug: 'api-and-integrations',
        title: 'API & integrations',
        description: 'API keys, the REST API, outbound webhooks, and Zapier/Make/n8n.',
        icon: KeyRound,
      },
    ],
  },
  {
    label: 'Help',
    pages: [
      {
        slug: 'support',
        title: 'Support & walkthrough',
        description: 'Getting help from the team and replaying the guided tour.',
        icon: Headset,
      },
    ],
  },
];

export const ALL_DOCS_PAGES: DocsPage[] = DOCS_NAV.flatMap((c) => c.pages);

export function docHref(slug: string): string {
  return `/docs/${slug}`;
}

/** Previous/next page across the whole nav, in reading order — powers
 *  the footer pager at the bottom of every doc page. */
export function docsSiblings(slug: string): { prev: DocsPage | null; next: DocsPage | null } {
  const idx = ALL_DOCS_PAGES.findIndex((p) => p.slug === slug);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? ALL_DOCS_PAGES[idx - 1] : null,
    next: idx < ALL_DOCS_PAGES.length - 1 ? ALL_DOCS_PAGES[idx + 1] : null,
  };
}
