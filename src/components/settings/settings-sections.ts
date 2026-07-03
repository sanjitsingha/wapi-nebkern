import {
  Coins,
  KeyRound,
  PlugZap,
  Tags,
  User,
  UsersRound,
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
  'api-access',
  'integrations',
  'fields',
  'deals',
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
    label: 'Profile & security',
    icon: User,
    group: 'account',
  },
  whatsapp: {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: PlugZap,
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
  fields: {
    id: 'fields',
    label: 'Fields & tags',
    icon: Tags,
    group: 'workspace',
  },
  deals: {
    id: 'deals',
    label: 'Deals & currency',
    icon: Coins,
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
 * their new homes (Tags + Custom fields → "Fields & tags"; Security and
 * the removed Overview → "Profile & security"). Anything unknown falls
 * back to the default section.
 */
export function resolveSection(raw: string | null): SettingsSection {
  if (raw === 'tags' || raw === 'custom-fields') return 'fields';
  if (raw === 'security' || raw === 'overview') return 'profile';
  if (isSection(raw)) return raw;
  return DEFAULT_SECTION;
}
