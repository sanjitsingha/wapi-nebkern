/**
 * Shared display config for whatsapp_forms.status — Meta's own Flow
 * status enum, verbatim (see src/lib/whatsapp/forms.ts). Mirrors
 * src/lib/template-status.ts so both content types read consistently.
 */

import { softBadge } from '@/lib/badge-colors';
import type { WhatsAppFormStatus } from '@/types';

export interface FormStatusDisplay {
  label: string;
  classes: string;
}

export const formStatusConfig: Record<WhatsAppFormStatus, FormStatusDisplay> = {
  DRAFT: { label: 'Draft', classes: softBadge.neutral },
  PUBLISHED: { label: 'Published', classes: softBadge.primary },
  DEPRECATED: { label: 'Deprecated', classes: softBadge.neutral },
  BLOCKED: { label: 'Blocked', classes: softBadge.red },
  THROTTLED: { label: 'Throttled', classes: softBadge.amber },
};
