import {
  AtSign,
  KeyRound,
  Phone,
  PlugZap,
  SlidersHorizontal,
  Store,
  User,
  UsersRound,
  Wallet,
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
 */
export const SETTINGS_SECTIONS = [
  'profile',
  'whatsapp',
  'calling',
  'instagram',
  'business-profile',
  'billing',
  'api-access',
  'integrations',
  'customization',
  'members',
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const DEFAULT_SECTION: SettingsSection = 'profile';

/** Rail grouping. `adminOnly` items are hidden for non-admins. */
export interface SectionMeta {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  group: 'account' | 'workspace';
}

export const SECTION_META: Record<SettingsSection, SectionMeta> = {
  profile: {
    id: 'profile',
    label: 'Profile',
    icon: User,
    group: 'account',
  },
  whatsapp: {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: PlugZap,
    group: 'workspace',
  },
  calling: {
    id: 'calling',
    label: 'Calling',
    icon: Phone,
    group: 'workspace',
  },
  instagram: {
    id: 'instagram',
    label: 'Instagram',
    icon: AtSign,
    group: 'workspace',
  },
  'business-profile': {
    id: 'business-profile',
    label: 'Business Profile',
    icon: Store,
    group: 'workspace',
  },
  billing: {
    id: 'billing',
    label: 'Billing & usage',
    icon: Wallet,
    group: 'workspace',
  },
  'api-access': {
    id: 'api-access',
    label: 'API Access',
    icon: KeyRound,
    group: 'workspace',
  },
  integrations: {
    id: 'integrations',
    label: 'Integrations',
    icon: PlugZap,
    group: 'workspace',
  },
  customization: {
    id: 'customization',
    label: 'Customization',
    icon: SlidersHorizontal,
    group: 'workspace',
  },
  members: {
    id: 'members',
    label: 'Team members',
    icon: UsersRound,
    group: 'workspace',
  },
};

export const RAIL_GROUPS: {
  label: string | null;
  group: SectionMeta['group'];
}[] = [
  { label: 'Account', group: 'account' },
  { label: 'Workspace', group: 'workspace' },
];

export function isSection(value: string | null): value is SettingsSection {
  return !!value && (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

/** Canonical URL for a settings section. */
export function sectionHref(section: SettingsSection): string {
  return `/settings/${section}`;
}

/**
 * Resolve a raw `?tab=` value to a section. Legacy tabs collapse onto
 * their new homes:
 *   - Tags / Custom fields / Fields / Deals → "Customization" (tabs)
 *   - Security / Overview / Plan            → "Profile" (Plan is a card there)
 *   - Quick replies / Catalogue             → "Business Profile" (tabs)
 * Anything unknown falls back to the default section.
 */
export function resolveSection(raw: string | null): SettingsSection {
  if (
    raw === 'tags' ||
    raw === 'custom-fields' ||
    raw === 'fields' ||
    raw === 'deals'
  ) {
    return 'customization';
  }
  if (raw === 'security' || raw === 'overview' || raw === 'plan') return 'profile';
  if (raw === 'quick-replies' || raw === 'catalog') return 'business-profile';
  if (isSection(raw)) return raw;
  return DEFAULT_SECTION;
}
