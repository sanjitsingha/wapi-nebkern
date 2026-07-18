// ============================================================
// Invoice shared types + constants (migration 055).
//
// One provider-neutral shape used by the admin invoice manager, the
// tenant Plan tab, and the printable invoice page.
// ============================================================

export type InvoiceStatus = 'due' | 'paid' | 'void';

/** An invoice row, camelCased for the client. `amount` is MINOR units. */
export interface Invoice {
  id: string;
  invoiceNumber: string | null;
  planKey: string | null;
  description: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string;
  dueDate: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  notes: string | null;
}

/** The snake_case DB shape (columns from migration 055). */
export interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  plan_key: string | null;
  description: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  period_start: string | null;
  period_end: string | null;
  issued_at: string;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  notes: string | null;
}

/** DB row → client Invoice. */
export function mapInvoiceRow(r: InvoiceRow): Invoice {
  return {
    id: r.id,
    invoiceNumber: r.invoice_number,
    planKey: r.plan_key,
    description: r.description,
    amount: r.amount,
    currency: r.currency,
    status: r.status,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    issuedAt: r.issued_at,
    dueDate: r.due_date,
    paidAt: r.paid_at,
    paymentMethod: r.payment_method,
    paymentReference: r.payment_reference,
    notes: r.notes,
  };
}

/** Payment methods offered in the admin "record payment" form. */
export const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'other', label: 'Other' },
] as const;

export function paymentMethodLabel(value: string | null): string {
  if (!value) return '—';
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;
}

/**
 * Seller ("bill from") details for the printable invoice. Placeholders —
 * edit these to your registered business name / address / tax id before
 * issuing real invoices.
 */
export const INVOICE_COMPANY = {
  name: 'Convero',
  tagline: 'Whatsapp Automation Platform',
  email: 'billing@nebkern.com',
  addressLines: [] as string[],
  taxId: '' as string,
};
