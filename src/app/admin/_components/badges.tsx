import { softBadge } from '@/lib/badge-colors';
import { cn } from '@/lib/utils';
import type { SupportTicketStatus, SupportTicketPriority } from '@/types';
import type { SubscriptionStatus } from '@/lib/billing/subscription';

const base =
  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize';

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
  return <span className={cn(base, TICKET[status] ?? softBadge.neutral)}>{status}</span>;
}

export function PriorityBadge({ priority }: { priority: SupportTicketPriority }) {
  return (
    <span className={cn(base, PRIORITY[priority] ?? softBadge.neutral)}>
      {priority}
    </span>
  );
}
