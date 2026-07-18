import { NextResponse } from 'next/server'

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { mapInvoiceRow, type InvoiceRow } from '@/lib/billing/invoice'

const COLUMNS =
  'id, invoice_number, plan_key, description, amount, currency, status, period_start, period_end, issued_at, due_date, paid_at, payment_method, payment_reference, notes'

/**
 * GET /api/account/invoices
 *
 * The caller's own invoices, newest first. Any account member can read
 * them (RLS scopes to the account). Voided invoices are hidden from
 * tenants — they're an admin bookkeeping state.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()

    const { data } = await supabase
      .from('invoices')
      .select(COLUMNS)
      .eq('account_id', accountId)
      .neq('status', 'void')
      .order('issued_at', { ascending: false })

    const invoices = ((data ?? []) as InvoiceRow[]).map(mapInvoiceRow)
    return NextResponse.json({ invoices })
  } catch (err) {
    return toErrorResponse(err)
  }
}
