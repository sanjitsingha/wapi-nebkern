import { softBadge } from '@/lib/badge-colors';
import { cn } from '@/lib/utils';
import type { SupportTicketStatus, SupportTicketPriority } from '@/types';
import type { SubscriptionStatus } from '@/lib/billing/subscription';

// Squared off, not a pill. A rounded-full badge is the one shape that
// cannot be reconciled with the panel's 2px corners — at this size the
// eye reads the two radii side by side and the pill looks pasted on
// from another design. `rounded-sm` inherits the admin `--radius`.
const base =
  'inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-tight lowercase';

const SUBSCRIPTION: Record<SubscriptionStatus, string> = {
  trialing: softBadge.blue,
  active: softBadge.primary,
  past_due: softBadge.amber,
  canceled: softBadge.neutral,
  expired: softBadge.red,
};

const TICKET: Record<SupportTicketStatus, string> = {
  open: softBadge.blue,
  pending: softBadge.amber,
  resolved: softBadge.primary,
  closed: softBadge.neutral,
};

const PRIORITY: Record<SupportTicketPriority, string> = {
  low: softBadge.neutral,
  normal: softBadge.blue,
  high: softBadge.red,
};

export function SubscriptionBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <span className={cn(base, SUBSCRIPTION[status] ?? softBadge.neutral)}>
      {status.replace('_', ' ')}
    </span>
  );
}

export function TicketStatusBadge({ status }: { status: SupportTicketStatus }) {
  return (
    <span className={cn(base, TICKET[status] ?? softBadge.neutral)}>
      {status}
    </span>
  );
}

export function PriorityBadge({
  priority,
}: {
  priority: SupportTicketPriority;
}) {
  return (
    <span className={cn(base, PRIORITY[priority] ?? softBadge.neutral)}>
      {priority}
    </span>
  );
}
