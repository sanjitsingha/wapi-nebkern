import {
  Shield,
  UserCog,
  UserIcon,
  type LucideIcon,
} from 'lucide-react';

import { softBadge } from '@/lib/badge-colors';
import type { AccountRole } from '@/lib/auth/roles';
import type { ChipVariant } from './settings-chip';

/**
 * Single source of truth for per-role chip metadata across settings
 * surfaces (the Overview identity chip and the Members roster/invite
 * chips). Previously duplicated in both files; hoisted here so a label,
 * icon, or colour change lands once.
 *
 * `variant` drives the token-based <SettingsChip>; `className` is the
 * inline Tailwind string the Members tab applies to its own spans.
 */
export const ROLE_META: Record<
  AccountRole,
  { icon: LucideIcon | null; label: string; variant: ChipVariant; className: string }
> = {
  owner: {
    icon: null,
    label: 'Admin',
    variant: 'muted',
    className: 'border-border bg-transparent text-foreground',
  },
  admin: {
    icon: Shield,
    label: 'Admin',
    variant: 'admin',
    className: 'border-primary/40 bg-primary/10 text-primary',
  },
  agent: {
    icon: UserCog,
    label: 'Agent',
    variant: 'muted',
    className: 'border-border bg-muted text-muted-foreground',
  },
  viewer: {
    icon: UserIcon,
    label: 'Viewer',
    variant: 'muted',
    // Outline-only so it stays quieter than the filled Agent chip in
    // both modes — bg-card would blend into a card surface in light mode.
    className: 'border-border bg-transparent text-muted-foreground',
  },
};

/**
 * What each role may do, for the member editor's permission list —
 * every entry names the least role that has it. Mirrors the predicates
 * in lib/auth/roles.ts and the API guards behind them: agent+ writes
 * operational data, admin+ edits settings, manages members, pays and
 * reads the activity log, and only the owner deletes or hands over the
 * account. Change a guard, change this list.
 */
export const ROLE_PERMISSIONS: { label: string; min: AccountRole }[] = [
  { label: 'See conversations, contacts, deals and reports', min: 'viewer' },
  { label: 'Reply to customers and send messages', min: 'agent' },
  { label: 'Add and edit contacts, lists and deals', min: 'agent' },
  { label: 'Run campaigns, automations and flows', min: 'agent' },
  { label: 'Use quick replies and the media library', min: 'agent' },
  { label: 'Change settings — channels, templates, tags & fields, integrations, Maya', min: 'admin' },
  { label: 'Invite and remove members, and change their roles', min: 'admin' },
  { label: 'Pay for plans and see the activity log', min: 'admin' },
  { label: 'Transfer ownership or delete the account', min: 'owner' },
];
