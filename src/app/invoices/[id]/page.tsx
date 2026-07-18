import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { formatMoney } from '@/lib/billing/plans';
import {
  mapInvoiceRow,
  paymentMethodLabel,
  INVOICE_COMPANY,
  type InvoiceRow,
} from '@/lib/billing/invoice';
import { PrintButton } from './print-button';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLUMNS =
  'id, invoice_number, plan_key, description, amount, currency, status, period_start, period_end, issued_at, due_date, paid_at, payment_method, payment_reference, notes, account_id';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  return new Date(t).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Printable invoice. A standalone (non-dashboard) page so it prints clean.
 * RLS scopes the query to the caller's account — a member can only open
 * their own invoices; anyone else's id 404s.
 */
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: row } = await supabase
    .from('invoices')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (!row) notFound();

  const invoice = mapInvoiceRow(row as InvoiceRow);
  const accountId = (row as { account_id: string }).account_id;

  const { data: account } = await supabase
    .from('accounts')
    .select('name, owner_user_id')
    .eq('id', accountId)
    .maybeSingle();

  let ownerEmail: string | null = null;
  if (account?.owner_user_id) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', account.owner_user_id)
      .maybeSingle();
    ownerEmail = prof?.email ?? null;
  }

  const paid = invoice.status === 'paid';
  const total = formatMoney(invoice.amount, invoice.currency);

  return (
    <div className="min-h-screen bg-neutral-100 py-8 text-neutral-900 print:bg-white print:py-0">
      {/* Print CSS: hide the toolbar and neutralize the page background. */}
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 16mm; } }`}</style>

      <div className="mx-auto max-w-3xl px-4">
        <div className="no-print mb-4 flex items-center justify-between">
          <Link
            href="/settings/profile?tab=plan"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900"
          >
            <ArrowLeft className="size-4" />
            Back to plan
          </Link>
          <PrintButton />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-8 shadow-sm print:border-0 print:p-0 print:shadow-none sm:p-10">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-lg font-bold">{INVOICE_COMPANY.name}</p>
              {INVOICE_COMPANY.tagline && (
                <p className="text-sm text-neutral-500">
                  {INVOICE_COMPANY.tagline}
                </p>
              )}
              {INVOICE_COMPANY.addressLines.map((l) => (
                <p key={l} className="text-xs text-neutral-500">
                  {l}
                </p>
              ))}
              {INVOICE_COMPANY.email && (
                <p className="text-xs text-neutral-500">{INVOICE_COMPANY.email}</p>
              )}
              {INVOICE_COMPANY.taxId && (
                <p className="text-xs text-neutral-500">
                  Tax ID: {INVOICE_COMPANY.taxId}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tracking-tight">INVOICE</p>
              <p className="mt-1 text-sm text-neutral-600">
                {invoice.invoiceNumber ?? '—'}
              </p>
              <span
                className={
                  'mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ' +
                  (paid
                    ? 'bg-emerald-100 text-emerald-700'
                    : invoice.status === 'due'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-neutral-200 text-neutral-600')
                }
              >
                {paid ? 'Paid' : invoice.status === 'due' ? 'Due' : 'Void'}
              </span>
            </div>
          </div>

          {/* Meta: bill-to + dates */}
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                Billed to
              </p>
              <p className="mt-1 text-sm font-medium">{account?.name ?? '—'}</p>
              {ownerEmail && (
                <p className="text-sm text-neutral-500">{ownerEmail}</p>
              )}
            </div>
            <div className="sm:text-right">
              <div className="text-sm">
                <span className="text-neutral-500">Issued: </span>
                {fmtDate(invoice.issuedAt)}
              </div>
              {invoice.dueDate && (
                <div className="text-sm">
                  <span className="text-neutral-500">Due: </span>
                  {fmtDate(invoice.dueDate)}
                </div>
              )}
              {paid && invoice.paidAt && (
                <div className="text-sm">
                  <span className="text-neutral-500">Paid: </span>
                  {fmtDate(invoice.paidAt)}
                </div>
              )}
            </div>
          </div>

          {/* Line items */}
          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-400">
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-100">
                <td className="py-3">
                  <p className="font-medium">{invoice.description}</p>
                  {(invoice.periodStart || invoice.periodEnd) && (
                    <p className="text-xs text-neutral-500">
                      {fmtDate(invoice.periodStart)} – {fmtDate(invoice.periodEnd)}
                    </p>
                  )}
                </td>
                <td className="py-3 text-right tabular-nums">{total}</td>
              </tr>
            </tbody>
          </table>

          {/* Total */}
          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-xs space-y-1">
              <div className="flex justify-between border-t border-neutral-200 pt-3 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{total}</span>
              </div>
            </div>
          </div>

          {/* Payment details */}
          {paid && (invoice.paymentMethod || invoice.paymentReference) && (
            <div className="mt-8 rounded-lg bg-neutral-50 p-4 text-sm print:bg-transparent print:p-0">
              <p className="font-medium">Payment</p>
              <p className="text-neutral-600">
                {paymentMethodLabel(invoice.paymentMethod)}
                {invoice.paymentReference ? ` · ${invoice.paymentReference}` : ''}
              </p>
            </div>
          )}

          {invoice.notes && (
            <div className="mt-6 text-xs text-neutral-500">
              <p className="font-medium text-neutral-600">Notes</p>
              <p className="mt-1 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}

          <p className="mt-10 text-center text-xs text-neutral-400">
            Thank you for your business.
          </p>
        </div>
      </div>
    </div>
  );
}
