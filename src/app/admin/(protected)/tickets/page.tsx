import { adminDb } from '../../_lib/admin-db';
import { getAccountsMap } from '../../_lib/admin-data';
import { TicketsTable, type TicketView } from '../../_components/tickets-table';
import type { SupportTicketStatus, SupportTicketPriority } from '@/types';

export const dynamic = 'force-dynamic';

interface TicketRow {
  id: string;
  account_id: string;
  user_id: string | null;
  subject: string;
  category: string;
  priority: string;
  status: string;
  last_message_at: string | null;
  last_support_reply_at: string | null;
  updated_at: string;
}

function needsReply(t: TicketRow): boolean {
  if (t.status === 'closed' || t.status === 'resolved') return false;
  if (!t.last_message_at) return false;
  if (!t.last_support_reply_at) return true;
  return Date.parse(t.last_message_at) > Date.parse(t.last_support_reply_at);
}

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const db = adminDb();

  // The tickets themselves are read fresh every time — support is the
  // one place a minute-old view sends you away from a queue that isn't
  // actually clear. The two label lookups beside them are cached.
  const [ticketsRes, nameByAccount, profilesRes] = await Promise.all([
    db
      .from('support_tickets')
      .select(
        'id, account_id, user_id, subject, category, priority, status, last_message_at, last_support_reply_at, updated_at'
      )
      .order('updated_at', { ascending: false }),
    getAccountsMap(),
    db.from('profiles').select('user_id, email'),
  ]);

  const tickets = (ticketsRes.data ?? []) as TicketRow[];
  const emailByUser = new Map<string, string | null>();
  for (const p of (profilesRes.data ?? []) as {
    user_id: string;
    email: string | null;
  }[]) {
    emailByUser.set(p.user_id, p.email);
  }

  const rows: TicketView[] = tickets.map((t) => ({
    id: t.id,
    subject: t.subject,
    accountName: nameByAccount.get(t.account_id) ?? '—',
    creatorEmail: t.user_id ? (emailByUser.get(t.user_id) ?? null) : null,
    category: t.category,
    priority: t.priority as SupportTicketPriority,
    status: t.status as SupportTicketStatus,
    updatedAt: t.updated_at,
    needsReply: needsReply(t),
  }));

  const openCount = rows.filter(
    (r) => r.status === 'open' || r.status === 'pending'
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">Support tickets</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {rows.length} total · {openCount} open
        </p>
      </div>
      <TicketsTable rows={rows} initialFilter={filter ?? 'all'} />
    </div>
  );
}
