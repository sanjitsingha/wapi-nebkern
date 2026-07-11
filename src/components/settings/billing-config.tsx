'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CreditCard,
  ExternalLink,
  Loader2,
  MessagesSquare,
  RefreshCw,
  Wallet,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SettingsPanelHead } from './settings-panel-head';

type NotConfiguredReason =
  | 'no_config'
  | 'token_corrupted'
  | 'no_waba'
  | 'meta_api_error';

interface CategoryBreakdown {
  category: string;
  cost: number;
  conversations: number;
}

interface CreditLineStatus {
  attached: boolean;
  legalEntityName: string | null;
}

interface BillingState {
  currency: string | null;
  estimatedCost: number;
  conversations: number;
  byCategory: CategoryBreakdown[];
  creditLine: CreditLineStatus | null;
  periodStart: number;
  periodEnd: number;
}

/** WhatsApp Manager is where the *actual* balance/credit lives — Meta has
 *  no wallet-balance API, so we deep-link there for the real figure. */
const WHATSAPP_MANAGER_URL = 'https://business.facebook.com/wa/manage/';

function formatMoney(amount: number, currency: string | null): string {
  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
      }).format(amount);
    } catch {
      // Unknown/misformatted currency code — fall through to plain number.
    }
  }
  return amount.toFixed(2);
}

function formatPeriod(startSec: number, endSec: number): string {
  const start = new Date(startSec * 1000);
  const end = new Date(endSec * 1000);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString(
    'en-US',
    { ...opts, year: 'numeric' },
  )}`;
}

/** Title-case a Meta category constant, e.g. AUTHENTICATION → Authentication. */
function categoryLabel(category: string): string {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

export function BillingConfig() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<BillingState | null>(null);
  const [notConfigured, setNotConfigured] = useState<{
    reason: NotConfiguredReason;
    message: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/billing');
      const body = await res.json();
      if (body.configured) {
        setState({
          currency: body.currency ?? null,
          estimatedCost: Number(body.estimatedCost) || 0,
          conversations: Number(body.conversations) || 0,
          byCategory: Array.isArray(body.byCategory) ? body.byCategory : [],
          creditLine: body.creditLine ?? null,
          periodStart: Number(body.periodStart) || 0,
          periodEnd: Number(body.periodEnd) || 0,
        });
        setNotConfigured(null);
      } else {
        setState(null);
        setNotConfigured({ reason: body.reason, message: body.message });
      }
    } catch {
      setState(null);
      setNotConfigured({
        reason: 'meta_api_error',
        message: 'Could not load usage. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <SettingsPanelHead
        title="Billing & usage"
        description="Your estimated WhatsApp spend this billing period, from Meta's conversation analytics. Meta does not expose a live wallet balance via API — open WhatsApp Manager for your actual balance and invoices."
      />

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading usage…
        </div>
      ) : notConfigured ? (
        <Alert
          variant={notConfigured.reason === 'no_config' ? 'default' : 'destructive'}
        >
          <AlertTriangle className="size-4" />
          <AlertTitle>
            {notConfigured.reason === 'no_config'
              ? 'WhatsApp not connected'
              : notConfigured.reason === 'token_corrupted'
                ? 'Connection needs re-saving'
                : notConfigured.reason === 'no_waba'
                  ? 'WhatsApp Business Account missing'
                  : 'Usage not available yet'}
          </AlertTitle>
          <AlertDescription>
            {notConfigured.message}
            {notConfigured.reason === 'no_config' && (
              <>
                {' '}
                <Link href="/settings/whatsapp" className="underline">
                  Go to WhatsApp settings
                </Link>
                .
              </>
            )}
          </AlertDescription>
        </Alert>
      ) : state ? (
        <div className="space-y-4">
          {/* Estimated spend + conversation count */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Wallet className="size-4" />
                  <p className="text-xs font-medium">Estimated spend</p>
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                  {formatMoney(state.estimatedCost, state.currency)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatPeriod(state.periodStart, state.periodEnd)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MessagesSquare className="size-4" />
                  <p className="text-xs font-medium">Conversations</p>
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                  {state.conversations.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Billable conversations this period
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Credit line (postpaid) — status only; Meta has no balance API */}
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                  state.creditLine?.attached
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <CreditCard className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {state.creditLine === null
                    ? 'Credit line status unavailable'
                    : state.creditLine.attached
                      ? 'Credit line attached'
                      : 'No credit line attached'}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {state.creditLine === null
                    ? 'Needs a token with business access — expected until the client’s Meta business is verified.'
                    : state.creditLine.attached
                      ? state.creditLine.legalEntityName
                        ? `Billed to ${state.creditLine.legalEntityName}`
                        : 'A postpaid credit line is set up for this account.'
                      : 'This account has no postpaid credit line — it may be prepaid or not billing-ready yet.'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Per-category breakdown */}
          {state.byCategory.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="mb-3 text-sm font-medium text-foreground">
                  By category
                </p>
                <ul className="divide-y divide-border">
                  {state.byCategory.map((c) => (
                    <li
                      key={c.category}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {categoryLabel(c.category)}
                        <span className="ml-2 text-xs text-muted-foreground/70">
                          {c.conversations.toLocaleString()} conv.
                        </span>
                      </span>
                      <span className="font-medium tabular-nums text-foreground">
                        {formatMoney(c.cost, state.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              render={
                <a
                  href={WHATSAPP_MANAGER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              Open WhatsApp Manager
              <ExternalLink className="size-4" />
            </Button>
          </div>

          <Alert>
            <Wallet className="size-4" />
            <AlertTitle>About this figure</AlertTitle>
            <AlertDescription>
              This is an <strong>estimate</strong> derived from Meta&apos;s
              conversation cost analytics, not a live wallet balance — Meta
              doesn&apos;t offer a balance API. Your true balance, credit line,
              and invoices live in WhatsApp Manager → Billing &amp; payments.
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
    </div>
  );
}
