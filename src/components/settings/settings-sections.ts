import {
  AtSign,
  Camera,
  KeyRound,
  MessageCircle,
  MessageSquareCode,
  Phone,
  PlugZap,
  Sparkles,
  Store,
  Tags,
  User,
  UsersRound,
  Wallet,
  Webhook,
  type LucideIcon,
} from 'lucide-react';

/**
 * Settings information architecture.
 *
 * A grouped left rail of sections. The URL query param stays `?tab=`
 * (deep-linkable, and it keeps existing links in sidebar.tsx /
 * header.tsx working) — legacy values are mapped onto their new homes
 * in `resolveSection`. There is no Overview landing: `/settings`
 * redirects to the default section, and Profile & security is one
 * combined section.
 *
 * This is every valid section route. What the rail actually shows is
 * `RAIL_SECTIONS` — sections marked `hiddenUnder` stay routable but are
 * reached from their parent section instead of from the nav.
 *
 * Order matters: the rail filters this array per group and keeps its
 * order, so this is also the top-to-bottom order within each group.
 */
export const SETTINGS_SECTIONS = [
  // Maya — alone, above everything, in a group with no heading.
  'maya',
  // Account — you, not the workspace.
  'profile',
  // Workspace — the business everyone on the team shares.
  'business-profile',
  'members',
  'billing',
  'customization',
  // Channels — every way a conversation can reach the inbox.
  'whatsapp',
  'calling',
  'meta',
  'instagram',
  'messenger',
  'widget',
  // Developers — credentials and wiring to other software.
  'api-access',
  'integrations',
  'developer-hub',
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const DEFAULT_SECTION: SettingsSection = 'profile';

/** Rail grouping. `adminOnly` items are hidden for non-admins. */
export interface SectionMeta {
  id: SettingsSection;
  label: string;
  /** Optional only because a section carrying a `mark` draws artwork
   *  instead of a glyph. Every other row needs one. */
  icon?: LucideIcon;
  /**
   * Draw the row as a wordmark rather than an icon and a label. Maya is
   * the only section with artwork of her own and should stay the only
   * one — a rail of competing logos is not a nav.
   *
   * `label` is still required: it is the row's accessible fallback and
   * what the lock and coming-soon tooltips quote.
   */
  mark?: 'maya';
  group: 'assistant' | 'account' | 'workspace' | 'channels' | 'developers';
  /**
   * Shelved channel: the rail shows the entry with a "Soon" badge and
   * makes it non-navigable, and the section's page renders the
   * coming-soon card instead of its connect UI. Distinct from the
   * plan-gated lock in SECTION_FEATURE — that one says "upgrade to get
   * this", this one says "nobody has this yet".
   */
  comingSoon?: boolean;
  /**
   * Sub-page of another section: the route stays live and deep-linkable,
   * but it gets no rail entry of its own — you reach it from the parent,
   * and the parent's entry is what lights up while you're on it.
   *
   * Used to keep one nav row per job. Two sections that configure the
   * same thing read as a duplicate even when one is a deeper cut of the
   * other, so the deeper one hides behind its parent instead.
   */
  hiddenUnder?: SettingsSection;
}

/**
 * Labels are sentence case throughout — only brand names keep their own
 * capitals (WhatsApp, Instagram, Messenger). Each label names what the
 * page actually does rather than the drawer it once lived in.
 *
 * Declared in the same order as SETTINGS_SECTIONS.
 */
export const SECTION_META: Record<SettingsSection, SectionMeta> = {
  /* ── Maya ────────────────────────────────────────────────────────── */
  // The assistant herself, not her credentials — those are "AI & models"
  // under Developers, which is where the provider, key and model live.
  // This is where you talk to her and see whether she is live.
  //
  // In a group of her own above Account, with no heading over it: she is
  // not an account setting or a workspace one, and a heading over a
  // single row is a label looking for a list. The mark carries the name.
  maya: {
    id: 'maya',
    label: 'Maya',
    mark: 'maya',
    group: 'assistant',
  },

  /* ── Account ─────────────────────────────────────────────────────── */
  profile: {
    id: 'profile',
    label: 'Profile',
    icon: User,
    group: 'account',
  },

  /* ── Workspace ───────────────────────────────────────────────────── */
  'business-profile': {
    id: 'business-profile',
    label: 'Business profile',
    icon: Store,
    group: 'workspace',
  },
  members: {
    id: 'members',
    label: 'Team members',
    icon: UsersRound,
    group: 'workspace',
  },
  billing: {
    id: 'billing',
    label: 'Billing & usage',
    icon: Wallet,
    group: 'workspace',
  },
  // Named for its contents, not the drawer: the page is the fields and
  // tags manager and nothing else, now that the currency control has
  // moved to the pipeline board.
  customization: {
    id: 'customization',
    label: 'Fields & tags',
    icon: Tags,
    group: 'workspace',
  },

  /* ── Channels ────────────────────────────────────────────────────── */
  whatsapp: {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: PlugZap,
    group: 'channels',
  },
  calling: {
    id: 'calling',
    label: 'Calling',
    icon: Phone,
    group: 'channels',
  },
  // The one Meta row in the rail: a single Facebook login returns the
  // Page (Messenger) and the Instagram professional account linked to
  // it, sharing one access token. Both channels are connected,
  // reconnected and disconnected from here — together or one at a time.
  meta: {
    id: 'meta',
    label: 'Instagram & Messenger',
    icon: AtSign,
    group: 'channels',
  },
  // The long paths — reached from "Full setup" on the combined section
  // above, not from the rail. Same two channels, so a rail row each
  // would be three entries for one job. Still live routes: they hold
  // the webhook callback URL / verify token readouts and manual
  // credential entry, and each channel's OAuth callback redirects here.
  instagram: {
    id: 'instagram',
    label: 'Instagram',
    icon: Camera,
    group: 'channels',
    hiddenUnder: 'meta',
  },
  messenger: {
    id: 'messenger',
    label: 'Messenger',
    icon: MessageCircle,
    group: 'channels',
    hiddenUnder: 'meta',
  },
  // A channel too: the website widget is where a conversation starts,
  // not a cosmetic setting.
  widget: {
    id: 'widget',
    label: 'Chat widget',
    icon: MessageSquareCode,
    group: 'channels',
  },

  /* ── Developers ──────────────────────────────────────────────────── */
  'api-access': {
    id: 'api-access',
    label: 'API access',
    icon: KeyRound,
    group: 'developers',
  },
  // Its own glyph rather than another PlugZap — WhatsApp already wears
  // that one, and two identical icons in one rail read as a mistake.
  integrations: {
    id: 'integrations',
    label: 'Integrations',
    icon: Webhook,
    group: 'developers',
  },
  // "Developer hub" said where it sat, not what it held: the page is the
  // AI provider, its credentials and the model behind the agent.
  'developer-hub': {
    id: 'developer-hub',
    label: 'AI & models',
    icon: Sparkles,
    group: 'developers',
  },
};

export const RAIL_GROUPS: {
  label: string | null;
  group: SectionMeta['group'];
}[] = [
  // Headingless, and first. See SECTION_META.maya.
  { label: null, group: 'assistant' },
  { label: 'Account', group: 'account' },
  { label: 'Workspace', group: 'workspace' },
  { label: 'Channels', group: 'channels' },
  { label: 'Developers', group: 'developers' },
];

export function isSection(value: string | null): value is SettingsSection {
  return !!value && (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

/** The sections that get a rail entry — sub-pages are reached from their parent. */
export const RAIL_SECTIONS = SETTINGS_SECTIONS.filter(
  (s) => !SECTION_META[s].hiddenUnder,
);

/**
 * Which rail entry lights up for a section. A sub-page has no row of its
 * own, so it highlights its parent — otherwise the rail would show
 * nothing selected and the page would feel orphaned.
 */
export function railSection(section: SettingsSection): SettingsSection {
  return SECTION_META[section].hiddenUnder ?? section;
}

/** Canonical URL for a settings section. */
export function sectionHref(section: SettingsSection): string {
  return `/settings/${section}`;
}

/**
 * Resolve a raw `?tab=` value to a section. Legacy tabs collapse onto
 * their new homes:
 *   - Tags / Custom fields / Fields → "Customization"
 *   - Security / Overview / Plan    → "Profile" (Plan is a card there)
 *   - Quick replies / Catalogue     → "Business Profile" (tabs)
 * Anything unknown falls back to the default section. (The former "Deals"
 * tab is gone — its currency control moved to the pipeline board.)
 */
export function resolveSection(raw: string | null): SettingsSection {
  if (raw === 'tags' || raw === 'custom-fields' || raw === 'fields') {
    return 'customization';
  }
  if (raw === 'security' || raw === 'overview' || raw === 'plan') return 'profile';
  if (raw === 'quick-replies' || raw === 'catalog') return 'business-profile';
  if (isSection(raw)) return raw;
  return DEFAULT_SECTION;
}
