import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Users, Radio, LifeBuoy, MessageCircle } from 'lucide-react';

import { computeSubscription } from '@/lib/billing/subscription';
import { adminDb } from '../../../_lib/admin-db';
import { getPlans, getProfiles } from '../../../_lib/admin-data';
import { getWhatsAppDetail } from '../../../_lib/admin-whatsapp';
import { fmtDate, fmtDateTime, fmtMoney } from '../../../_lib/format';
import { SubscriptionBadge, WhatsAppBadge } from '../../../_components/badges';
import { StatCard, StatRow } from '../../../_components/ui';
import { SubscriptionEditor } from '../../../_components/subscription-editor';
import { BillingEditor } from '../../../_components/billing-editor';
import { InvoicesManager } from '../../../_components/invoices-manager';
import { mapInvoiceRow, type InvoiceRow } from '@/lib/billing/invoice';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd
        className={
          mono
            ? 'text-foreground mt-0.5 truncate font-mono text-xs'
            : 'text-foreground mt-0.5 truncate'
        }
      >
        {value || '—'}
      </dd>
    </div>
  );
}

// Members and the plan catalog are no longer queried here. Both come
// from the shared cached reads, filtered in memory — this page was
// re-fetching `billing_plans` in full and re-querying `profiles` for
// one account's rows on every visit.

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
      'id, name, owner_user_id, plan, subscription_status, trial_started_at, trial_ends_at, created_at, billing_plan_key, billing_amount, billing_currency, billing_interval, current_period_start, current_period_end'
    )
    .eq('id', id)
    .maybeSingle();

  if (!account) notFound();

  const [
    allProfiles,
    whatsapp,
    contactsRes,
    broadcastsRes,
    ticketsRes,
    plans,
    invoicesRes,
  ] = await Promise.all([
    getProfiles(),
    // Live Meta lookup for the readable number, capped at 5s so a slow
    // Meta can't hold up the rest of this page.
    getWhatsAppDetail(id),
    db
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', id),
    db
      .from('broadcasts')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', id),
    db
      .from('support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', id),
    getPlans(),
    db
      .from('invoices')
      .select(
        'id, invoice_number, plan_key, description, amount, currency, status, period_start, period_end, issued_at, due_date, paid_at, payment_method, payment_reference, notes'
      )
      .eq('account_id', id)
      .order('issued_at', { ascending: false }),
  ]);

  const invoices = ((invoicesRes.data ?? []) as InvoiceRow[]).map(
    mapInvoiceRow
  );

  const members = allProfiles.filter((p) => p.account_id === id);
  const sub = computeSubscription(account);
  const wa = whatsapp.status;
  const ownerEmail =
    members.find((m) => m.user_id === account.owner_user_id)?.email ?? null;
  const billingLabel =
    account.billing_amount != null
      ? `${fmtMoney(account.billing_amount, account.billing_currency ?? 'INR')}/${
          account.billing_interval === 'yearly' ? 'yr' : 'mo'
        }`
      : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/accounts"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" />
          Accounts
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-foreground text-2xl font-bold">
              {account.name}
            </h1>
            <SubscriptionBadge status={sub.status} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Owner {ownerEmail ?? '—'} · Created {fmtDate(account.created_at)}
            {billingLabel ? ` · ${billingLabel}` : ''}
          </p>
        </div>
      </div>

      {/* Its own card rather than a clause in the subtitle above: whether
          a signup has connected a number is the first thing to check, and
          "not connected" buried mid-sentence was easy to read past. */}
      <section className="border-border bg-card rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-foreground text-sm font-medium">WhatsApp</h2>
          <WhatsAppBadge state={wa.state} />
        </div>

        {wa.state === 'not_connected' ? (
          <p className="text-muted-foreground mt-2 text-sm">
            No WhatsApp number connected yet.
          </p>
        ) : (
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Detail
              label="Number"
              value={whatsapp.live?.displayPhoneNumber}
            />
            <Detail
              label="Business name"
              value={whatsapp.live?.verifiedName}
            />
            <Detail label="Connected" value={fmtDateTime(wa.connectedAt)} />
            <Detail label="Phone number ID" value={wa.phoneNumberId} mono />
            <Detail label="WABA ID" value={wa.wabaId} mono />
            <Detail label="Registered" value={fmtDateTime(wa.registeredAt)} />
          </dl>
        )}

        {wa.state === 'token_broken' && (
          <p className="mt-3 text-xs text-red-600 dark:text-red-400">
            The saved access token no longer decrypts, so this account
            cannot send messages. The owner has to reconnect WhatsApp.
          </p>
        )}
        {whatsapp.liveError && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            Couldn&apos;t read the number from Meta: {whatsapp.liveError}
          </p>
        )}
        {wa.lastRegistrationError && (
          <p className="mt-3 text-xs text-red-600 dark:text-red-400">
            Last registration error: {wa.lastRegistrationError}
          </p>
        )}
      </section>

      <StatRow cols={4}>
        <StatCard
          label="Members"
          value={members.length}
          icon={<Users className="size-3.5" />}
        />
        <StatCard
          label="Contacts"
          value={(contactsRes.count ?? 0).toLocaleString()}
          icon={<MessageCircle className="size-3.5" />}
        />
        <StatCard
          label="Campaigns"
          value={(broadcastsRes.count ?? 0).toLocaleString()}
          icon={<Radio className="size-3.5" />}
        />
        <StatCard
          label="Tickets"
          value={ticketsRes.count ?? 0}
          icon={<LifeBuoy className="size-3.5" />}
        />
      </StatRow>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Keyed on what it displays. The editor copies its props into
            local state, and router.refresh() keeps client state — so
            without the key, saving billing (which activates the plan)
            left this card still reading "trialing" until a full reload. */}
        <SubscriptionEditor
          key={`${sub.plan}:${sub.status}:${account.trial_ends_at ?? ''}`}
          accountId={account.id}
          plan={sub.plan}
          status={sub.status}
          trialEndsAt={account.trial_ends_at}
          trialDaysLeft={sub.isTrial ? sub.trialDaysLeft : null}
        />

        <div className="border-border bg-card rounded-xl border p-4">
          <h2 className="text-foreground text-sm font-medium">
            Members ({members.length})
          </h2>
          <ul className="divide-border mt-3 divide-y">
            {members.length === 0 ? (
              <li className="text-muted-foreground py-3 text-sm">
                No members.
              </li>
            ) : (
              members.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm">
                      {m.full_name || m.email || 'Unknown'}
                    </p>
                    {m.full_name && m.email && (
                      <p className="text-muted-foreground truncate text-xs">
                        {m.email}
                      </p>
                    )}
                    <p className="text-muted-foreground truncate text-xs">
                      {m.phone ? (
                        <a
                          href={`tel:${m.phone}`}
                          className="hover:text-foreground"
                        >
                          {m.phone}
                        </a>
                      ) : (
                        'No phone yet'
                      )}
                    </p>
                  </div>
                  <span className="border-border bg-muted text-muted-foreground shrink-0 rounded-full border px-2 py-0.5 text-[11px] capitalize">
                    {m.account_role ?? 'member'}
                    {m.user_id === account.owner_user_id ? ' · owner' : ''}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <BillingEditor
        accountId={account.id}
        plans={plans}
        billingPlanKey={account.billing_plan_key ?? null}
        billingAmount={account.billing_amount ?? null}
        billingCurrency={account.billing_currency ?? 'INR'}
        billingInterval={account.billing_interval ?? null}
        periodStart={account.current_period_start ?? null}
        periodEnd={account.current_period_end ?? null}
      />

      <InvoicesManager
        accountId={account.id}
        invoices={invoices}
        defaults={{
          planKey: account.billing_plan_key ?? null,
          planName:
            plans.find((p) => p.key === account.billing_plan_key)?.name ?? null,
          amount: account.billing_amount ?? null,
          currency: account.billing_currency ?? 'INR',
          interval: account.billing_interval ?? null,
          periodStart: account.current_period_start ?? null,
          periodEnd: account.current_period_end ?? null,
        }}
      />

      <p className="text-muted-foreground text-xs">
        Trial started {fmtDateTime(account.trial_started_at)} · Trial ends{' '}
        {fmtDateTime(account.trial_ends_at)}
      </p>
    </div>
  );
}
