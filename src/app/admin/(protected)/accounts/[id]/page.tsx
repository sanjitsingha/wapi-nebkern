import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Users, Radio, LifeBuoy, MessageCircle } from 'lucide-react';

import { computeSubscription } from '@/lib/billing/subscription';
import { adminDb } from '../../../_lib/admin-db';
import { fmtDate, fmtDateTime } from '../../../_lib/format';
import { SubscriptionBadge } from '../../../_components/badges';
import { SubscriptionEditor } from '../../../_components/subscription-editor';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface MemberRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  account_role: string | null;
}

function UsageStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="mt-2 text-xl font-bold text-foreground">{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default async function AdminAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const db = adminDb();
  const { data: account } = await db
    .from('accounts')
    .select(
      'id, name, owner_user_id, plan, subscription_status, trial_started_at, trial_ends_at, created_at',
    )
    .eq('id', id)
    .maybeSingle();

  if (!account) notFound();

  const [membersRes, waRes, contactsRes, broadcastsRes, ticketsRes] =
    await Promise.all([
      db
        .from('profiles')
        .select('user_id, email, full_name, account_role')
        .eq('account_id', id),
      db.from('whatsapp_config').select('phone_number_id').eq('account_id', id).maybeSingle(),
      db.from('contacts').select('*', { count: 'exact', head: true }).eq('account_id', id),
      db.from('broadcasts').select('*', { count: 'exact', head: true }).eq('account_id', id),
      db.from('support_tickets').select('*', { count: 'exact', head: true }).eq('account_id', id),
    ]);

  const members = (membersRes.data ?? []) as MemberRow[];
  const sub = computeSubscription(account);
  const waConnected = !!waRes.data?.phone_number_id;
  const ownerEmail =
    members.find((m) => m.user_id === account.owner_user_id)?.email ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/accounts"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Accounts
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{account.name}</h1>
            <SubscriptionBadge status={sub.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Owner {ownerEmail ?? '—'} · Created {fmtDate(account.created_at)} ·{' '}
            {waConnected ? 'WhatsApp connected' : 'WhatsApp not connected'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <UsageStat
          label="Members"
          value={members.length}
          icon={<Users className="size-4" />}
        />
        <UsageStat
          label="Contacts"
          value={contactsRes.count ?? 0}
          icon={<MessageCircle className="size-4" />}
        />
        <UsageStat
          label="Campaigns"
          value={broadcastsRes.count ?? 0}
          icon={<Radio className="size-4" />}
        />
        <UsageStat
          label="Tickets"
          value={ticketsRes.count ?? 0}
          icon={<LifeBuoy className="size-4" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SubscriptionEditor
          accountId={account.id}
          plan={sub.plan}
          status={sub.status}
          trialEndsAt={account.trial_ends_at}
          trialDaysLeft={sub.isTrial ? sub.trialDaysLeft : null}
        />

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground">
            Members ({members.length})
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {members.length === 0 ? (
              <li className="py-3 text-sm text-muted-foreground">No members.</li>
            ) : (
              members.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {m.full_name || m.email || 'Unknown'}
                    </p>
                    {m.full_name && m.email && (
                      <p className="truncate text-xs text-muted-foreground">
                        {m.email}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                    {m.account_role ?? 'member'}
                    {m.user_id === account.owner_user_id ? ' · owner' : ''}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Trial started {fmtDateTime(account.trial_started_at)} · Trial ends{' '}
        {fmtDateTime(account.trial_ends_at)}
      </p>
    </div>
  );
}
