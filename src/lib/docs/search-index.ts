import { ALL_DOCS_PAGES, DOCS_NAV, docHref } from './nav';

/**
 * Search index for the docs site.
 *
 * There's no CMS/MDX layer here (see docs-components.tsx) — every page
 * is hand-authored TSX, so there's nothing to crawl at request time.
 * Instead, `terms` is a maintained-by-hand digest of each page's real
 * section headings and field/parameter names (extracted once from the
 * source, not paraphrased), so a search for something specific like
 * "flow_token" or "2-step PIN" or "quality rating" actually surfaces
 * the right page even though those words never appear in its title or
 * one-line description.
 *
 * Keep this in sync when a page's headings change materially — it's a
 * snapshot, not a live index.
 */
export interface DocsSearchEntry {
  slug: string;
  title: string;
  description: string;
  category: string;
  href: string;
  /** Section headings + notable field/parameter names, space-joined. */
  terms: string;
}

const TERMS: Record<string, string> = {
  'getting-started':
    'signup account trial 14-day free trial roles owner admin agent viewer team invite embedded signup contacts CSV import first conversation',
  whatsapp:
    'connecting your number embedded signup manual connect phone number ID WABA access token verify token 2-step PIN registration status phone health quality rating messaging limit tier business profile about description address email websites category vertical profile photo catalog commerce manager cart calling call icon layer A layer B',
  'instagram-messenger':
    'connect instagram messenger facebook login one button meta tech provider page picker linked instagram professional account webhook callback URL verify token DM only free-form text delivered read receipts disconnect reconnect',
  inbox:
    'conversation status open pending closed assignment teammate flow bot AI agent filter channel tabs all whatsapp messenger instagram tags 24-hour reply window session window composing message text image video document voice note templates reply quote reactions delivery status sending sent delivered read failed notes contact search unread presence',
  contacts:
    'contact fields phone email company date of birth marital status spouse name address marketing opt-out spam muted blocked custom fields tags duplicate handling normalized phone CSV import',
  'segments-and-lists':
    'lists static manual segments dynamic rule-based filter operators tag list membership custom field marketing opted-in created updated date',
  pipelines:
    'pipeline stages kanban drag and drop deal title value currency contact conversation assigned to notes expected close date status open won lost default currency',
  campaigns:
    'audience all contacts tags custom field segment upload CSV exclude personalizing variables static field send now schedule send batches recipients sent delivered read replied failed',
  templates:
    'category marketing utility authentication variable syntax header body footer buttons quick reply URL phone number copy code OTP carousel language draft pending approved rejected paused disabled quality rating',
  media:
    'image video document formats size limits storage plan library template header',
  automations:
    'trigger new message received keyword match new contact created first message condition tag presence contact field message content time of day action send message send template send buttons add tag remove tag assign conversation update contact field create deal wait webhook close conversation',
  flows:
    'send message send buttons send list send media collect input if else tag contact handoff to agent end keyword first inbound message manual trigger welcome menu FAQ bot lead capture draft active archived reprompt timeout',
  'ai-agents':
    'RAG retrieval augmented provider model system prompt auto-reply cap knowledge base documents playground handoff human debounce quiet period',
  team: 'roles owner admin agent viewer invite link expiry seat limit transfer ownership remove member',
  'account-settings':
    'profile security password sessions business profile fields tags custom fields deals currency',
  billing:
    '14-day trial plan tiers team size contacts storage calling automations flows integrations razorpay checkout activation code invoices subscription',
  'api-and-integrations':
    'API key wak header REST contacts messages template webhook message received contact created conversation assigned deal stage changed signature secret zapier make n8n',
  support: 'support ticket category priority status help contact team',
};

const CATEGORY_BY_SLUG: Record<string, string> = Object.fromEntries(
  DOCS_NAV.flatMap((category) => category.pages.map((p) => [p.slug, category.label])),
);

export const DOCS_SEARCH_INDEX: DocsSearchEntry[] = ALL_DOCS_PAGES.map((page) => ({
  slug: page.slug,
  title: page.title,
  description: page.description,
  category: CATEGORY_BY_SLUG[page.slug] ?? '',
  href: docHref(page.slug),
  terms: TERMS[page.slug] ?? '',
}));
