import {
  AtSign,
  Building2,
  Camera,
  CodeXml,
  KeyRound,
  MessageCircle,
  MessageSquareCode,
  MessagesSquare,
  Phone,
  PlugZap,
  ScrollText,
  Store,
  Tags,
  TextCursorInput,
  User,
  UserCog,
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
  // Account — you, not the workspace.
  'profile',
  // Workspace — the business everyone on the team shares.
  'business-profile',
  'members',
  'activity-log',
  'billing',
  'tags',
  'custom-fields',
  // Channels — every way a conversation can reach the inbox.
  'whatsapp',
  'calling',
  'meta',
  'instagram',
  'messenger',
  'widget',
  // Integrations — wiring to other software. The rail adds a row per
  // integration after these (see INTEGRATION_RAIL_LINKS).
  'integrations',
  'api-access',
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const DEFAULT_SECTION: SettingsSection = 'profile';

/** Rail grouping. `adminOnly` items are hidden for non-admins. */
export interface SectionMeta {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  group: 'account' | 'workspace' | 'channels' | 'integrations';
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
  /**
   * A row for the phone chip strip only. On desktop the rail lists what
   * the page holds row by row instead, so a row for the page as a whole
   * would only repeat them.
   */
  mobileOnly?: boolean;
}

/**
 * Labels are sentence case throughout — only brand names keep their own
 * capitals (WhatsApp, Instagram, Messenger). Each label names what the
 * page actually does rather than the drawer it once lived in.
 *
 * Declared in the same order as SETTINGS_SECTIONS.
 */
export const SECTION_META: Record<SettingsSection, SectionMeta> = {
  // Maya lives in the app sidebar (/askmaya) — every one of her settings
  // is there. The old "AI behaviour" / "AI & models" / "Developer hub"
  // section here is gone; /settings/developer-hub redirects to her.

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
  // The account activity log — who did what, when. Admin+ only to view
  // (the page and its API both gate on the role).
  'activity-log': {
    id: 'activity-log',
    label: 'Activity log',
    icon: ScrollText,
    group: 'workspace',
  },
  // "Billing & usage" was the whole problem: it sounded like the place
  // you manage your Instant subscription, which is Profile → Plan. This
  // page is what META bills for WhatsApp conversations — a different
  // company taking a different payment. The id stays 'billing' because
  // it is the URL; only the label and the page moved.
  billing: {
    id: 'billing',
    label: 'Meta charges',
    icon: Wallet,
    group: 'workspace',
  },
  // Tags and custom fields were one "Fields & tags" page (route
  // `customization`, which now redirects to Tags). Two different jobs —
  // quick colour labels anyone uses, and an admin-defined data schema —
  // so two pages.
  tags: {
    id: 'tags',
    label: 'Tags',
    icon: Tags,
    group: 'workspace',
  },
  'custom-fields': {
    id: 'custom-fields',
    label: 'Custom fields',
    icon: TextCursorInput,
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
  /* ── Integrations ────────────────────────────────────────────────── */
  // The overview grid. On desktop the rail lists each integration under
  // the heading instead, each jumping to its card on this page, so this
  // row is the phone's way in only.
  // Its own glyph rather than another PlugZap — WhatsApp already wears
  // that one, and two identical icons in one rail read as a mistake.
  integrations: {
    id: 'integrations',
    label: 'Integrations',
    icon: Webhook,
    group: 'integrations',
    mobileOnly: true,
  },
  'api-access': {
    id: 'api-access',
    label: 'API access',
    icon: KeyRound,
    group: 'integrations',
  },
};

/**
 * The rail's headings. Each carries the glyph for the whole group: the
 * rows under a heading are plain text, so the heading is where the
 * group is recognised at a glance.
 */
export const RAIL_GROUPS: {
  label: string;
  group: SectionMeta['group'];
  icon: LucideIcon;
}[] = [
  { label: 'Account', group: 'account', icon: UserCog },
  { label: 'Workspace', group: 'workspace', icon: Building2 },
  { label: 'Channels', group: 'channels', icon: MessagesSquare },
  { label: 'Integrations', group: 'integrations', icon: CodeXml },
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
 *   - Fields / Customization        → "Custom fields" / "Tags"
 *   - Security / Overview / Plan    → "Profile" (Plan is a card there)
 *   - Quick replies / Catalogue     → "Business Profile" (tabs)
 * Anything unknown falls back to the default section. (The former "Deals"
 * tab is gone — its currency control moved to the pipeline board.)
 */
export function resolveSection(raw: string | null): SettingsSection {
  if (raw === 'fields') return 'custom-fields';
  if (raw === 'customization') return 'tags';
  if (raw === 'security' || raw === 'overview' || raw === 'plan') return 'profile';
  if (raw === 'quick-replies' || raw === 'catalog') return 'business-profile';
  if (isSection(raw)) return raw;
  return DEFAULT_SECTION;
}
