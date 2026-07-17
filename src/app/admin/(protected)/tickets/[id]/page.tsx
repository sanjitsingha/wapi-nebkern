import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import type { SupportTicketMessage, SupportTicketStatus } from '@/types';
import { adminDb } from '../../../_lib/admin-db';
import { fmtDateTime } from '../../../_lib/format';
import { PriorityBadge } from '../../../_components/badges';
import { TicketThread } from '../../../_components/ticket-thread';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const db = adminDb();
  const { data: ticket } = await db
    .from('support_tickets')
    .select(
      'id, account_id, user_id, subject, category, priority, status, created_at',
    )
    .eq('id', id)
    .maybeSingle();

  if (!ticket) notFound();

  const [messagesRes, accountRes, creatorRes] = await Promise.all([
    db
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true }),
    db.from('accounts').select('id, name').eq('id', ticket.account_id).maybeSingle(),
    ticket.user_id
      ? db.from('profiles').select('email').eq('user_id', ticket.user_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const messages = (messagesRes.data ?? []) as SupportTicketMessage[];
  const accountName = accountRes.data?.name ?? '—';
  const creatorEmail =
    (creatorRes.data as { email?: string | null } | null)?.email ?? null;

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col space-y-4">
      <div>
        <Link
          href="/admin/tickets"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Tickets
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">{ticket.subject}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <Link
              href={`/admin/accounts/${ticket.account_id}`}
              className="text-foreground underline-offset-2 hover:underline"
            >
              {accountName}
            </Link>
            <span>·</span>
            <span>{creatorEmail ?? 'unknown'}</span>
            <span>·</span>
            <span className="capitalize">{ticket.category}</span>
            <span>·</span>
            <span>Opened {fmtDateTime(ticket.created_at)}</span>
          </p>
        </div>
        <PriorityBadge priority={ticket.priority} />
      </div>

      <TicketThread
        ticketId={ticket.id}
        initialStatus={ticket.status as SupportTicketStatus}
        initialMessages={messages}
      />
    </div>
  );
}
