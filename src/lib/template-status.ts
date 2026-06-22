/**
 * Shared display config for message_templates.status.
 *
 * The DB stores Meta's raw enum (DRAFT / APPROVED / PENDING / REJECTED /
 * PAUSED / DISABLED / IN_APPEAL / PENDING_DELETION) — the UI maps it to
 * a human label + shared light-first badge classes here so the template
 * manager, inbox picker, and broadcast picker stay aligned.
 */

import { softBadge } from '@/lib/badge-colors';
import type { MessageTemplateStatus } from '@/types';

export interface TemplateStatusDisplay {
  label: string;
  classes: string;
}

export const templateStatusConfig: Record<
  MessageTemplateStatus,
  TemplateStatusDisplay
> = {
  DRAFT: { label: 'Draft', classes: softBadge.neutral },
  PENDING: { label: 'Pending', classes: softBadge.amber },
  APPROVED: { label: 'Approved', classes: softBadge.primary },
  REJECTED: { label: 'Rejected', classes: softBadge.red },
  PAUSED: { label: 'Paused', classes: softBadge.amber },
  DISABLED: { label: 'Disabled', classes: softBadge.red },
  IN_APPEAL: { label: 'In Appeal', classes: softBadge.blue },
  PENDING_DELETION: { label: 'Pending Deletion', classes: softBadge.neutral },
};
