/**
 * Shared display config for lists.status (migration 042).
 */

import { softBadge } from '@/lib/badge-colors';
import type { ListStatus } from '@/types';

export interface ListStatusDisplay {
  label: string;
  classes: string;
}

export const listStatusConfig: Record<ListStatus, ListStatusDisplay> = {
  active: { label: 'Active', classes: softBadge.green },
  archived: { label: 'Archived', classes: softBadge.neutral },
};
