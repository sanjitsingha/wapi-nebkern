import { softBadge } from '@/lib/badge-colors';
import { cn } from '@/lib/utils';
import type { SupportTicketStatus, SupportTicketPriority } from '@/types';
import type { SubscriptionStatus } from '@/lib/billing/subscription';

// Squared off, not a pill. A rounded-full badge sitting inside the
// panel's tighter corners reads as pasted on from another design — at
// this size the eye takes in both radii at once. `rounded-sm` inherits
// the admin `--radius`, so these track it if it moves again.
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

export type EnquiryStatus = 'new' | 'read' | 'replied' | 'spam';

// Same reading as the ticket statuses beside them: blue is "came in,
// nobody has dealt with it", primary is "done". The enquiry list used
// to roll its own pills off a hardcoded emerald, which drifted from
// every other status in the panel.
const ENQUIRY: Record<EnquiryStatus, string> = {
  new: softBadge.blue,
  read: softBadge.amber,
  replied: softBadge.primary,
  spam: softBadge.red,
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

export function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
  return (
    <span className={cn(base, ENQUIRY[status] ?? softBadge.neutral)}>
      {status}
    </span>
  );
}

export type SubscriberStatus = 'subscribed' | 'unsubscribed';

const SUBSCRIBER: Record<SubscriberStatus, string> = {
  subscribed: softBadge.primary,
  unsubscribed: softBadge.neutral,
};

export function SubscriberStatusBadge({
  status,
}: {
  status: SubscriberStatus;
}) {
  return (
    <span className={cn(base, SUBSCRIBER[status] ?? softBadge.neutral)}>
      {status}
    </span>
  );
}
