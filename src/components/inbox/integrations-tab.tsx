'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowUpRight, Check, Copy, Loader2, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

// ============================================================
// Inbox → contact panel → Integrations.
//
// The person's record in each connected integration, read live —
// today Zoho CRM: the Lead or Contact they are synced with, the fields
// worth having mid-conversation, their deals, and a way into Zoho.
// Only fields with a value are shown.
// ============================================================

const ZOHO_LOGO = '/images/integrations/zoho-crm.png';

interface ZohoDeal {
  id: string;
  name: string | null;
  stage: string | null;
  amount: number | null;
  currency: string | null;
  closingDate: string | null;
  url: string | null;
}

interface ZohoRecord {
  module: 'Leads' | 'Contacts';
  id: string;
  url: string | null;
  name: string | null;
  owner: string | null;
  email: string | null;
  mobile: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  status: string | null;
  source: string | null;
  city: string | null;
  created: string | null;
  modified: string | null;
  lastActivity: string | null;
  deals: ZohoDeal[];
}

type ZohoState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'not-connected' }
  | { kind: 'not-synced' }
  | { kind: 'missing' }
  | { kind: 'record'; record: ZohoRecord };

function when(iso: string | null, withTime = true): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : format(d, withTime ? 'd MMM yyyy, HH:mm' : 'd MMM yyyy');
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right text-foreground">{value}</span>
    </div>
  );
}

export function IntegrationsTab({ contactId }: { contactId: string }) {
  // Keyed by contact so switching people never shows the previous
  // person's record while the next one loads.
  const [loaded, setLoaded] = useState<{ contactId: string; state: ZohoState } | null>(null);
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const state: ZohoState = loaded?.contactId === contactId ? loaded.state : { kind: 'loading' };

  const fetchState = useCallback(async (): Promise<ZohoState> => {
    try {
      const res = await fetch(`/api/integrations/zoho/record?contact_id=${contactId}`, {
        cache: 'no-store',
      });
      const d = (await res.json().catch(() => null)) as {
        connected?: boolean;
        record?: ZohoRecord | null;
        missing?: boolean;
      } | null;
      if (!res.ok || !d) return { kind: 'error' };
      if (!d.connected) return { kind: 'not-connected' };
      if (d.missing) return { kind: 'missing' };
      if (!d.record) return { kind: 'not-synced' };
      return { kind: 'record', record: d.record };
    } catch {
      return { kind: 'error' };
    }
  }, [contactId]);

  useEffect(() => {
    let cancelled = false;
    void fetchState().then((next) => {
      if (!cancelled) setLoaded({ contactId, state: next });
    });
    return () => {
      cancelled = true;
    };
  }, [fetchState, contactId, attempt]);

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (permissions); the id is on screen to select.
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="text-muted-foreground mb-2 flex items-center gap-2 text-[11px] font-medium">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ZOHO_LOGO} alt="" className="h-3.5 w-auto object-contain" />
        Zoho CRM
      </div>

      {state.kind === 'loading' && (
        <div className="flex justify-center py-8">
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
        </div>
      )}

      {state.kind === 'error' && (
        <div className="border-border rounded-lg border p-3 text-center">
          <p className="text-muted-foreground text-xs">Couldn&apos;t load this from Zoho.</p>
          <button
            type="button"
            onClick={() => {
              setLoaded(null);
              setAttempt((n) => n + 1);
            }}
            className="text-primary mt-2 inline-flex items-center gap-1 text-xs font-medium hover:underline"
          >
            <RefreshCw className="size-3" />
            Try again
          </button>
        </div>
      )}

      {state.kind === 'not-connected' && (
        <div className="border-border rounded-lg border p-3 text-center">
          <p className="text-muted-foreground text-xs">Zoho CRM isn&apos;t connected.</p>
          <Link
            href="/settings/integrations/zoho-crm"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-2')}
          >
            Connect Zoho CRM
          </Link>
        </div>
      )}

      {state.kind === 'not-synced' && (
        <p className="border-border text-muted-foreground rounded-lg border p-3 text-center text-xs">
          Not in Zoho yet.
        </p>
      )}

      {state.kind === 'missing' && (
        <p className="border-border text-muted-foreground rounded-lg border p-3 text-center text-xs">
          This record was deleted in Zoho.
        </p>
      )}

      {state.kind === 'record' && (
        <ZohoRecordView record={state.record} copied={copied} onCopy={copyId} />
      )}
    </div>
  );
}

function ZohoRecordView({
  record,
  copied,
  onCopy,
}: {
  record: ZohoRecord;
  copied: boolean;
  onCopy: (id: string) => void;
}) {
  const isLead = record.module === 'Leads';
  return (
    <>
      <div className="border-border rounded-lg border p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-foreground min-w-0 truncate text-sm font-semibold">
            {record.name ?? 'Unnamed'}
          </p>
          <span className="border-primary/30 bg-primary-soft text-primary shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium">
            {isLead ? 'Lead' : 'Contact'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onCopy(record.id)}
          title="Copy Zoho ID"
          className="text-muted-foreground hover:text-foreground mt-1 inline-flex max-w-full items-center gap-1.5 text-[11px]"
        >
          <span className="truncate font-mono">Zoho ID {record.id}</span>
          {copied ? (
            <Check className="text-primary size-3 shrink-0" />
          ) : (
            <Copy className="size-3 shrink-0" />
          )}
        </button>
        {record.url && (
          <a
            href={record.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: 'sm' }), 'mt-3 w-full')}
          >
            Open in Zoho
            <ArrowUpRight className="size-3.5" />
          </a>
        )}
      </div>

      <div className="mt-2">
        <Row label="Owner" value={record.owner} />
        <Row label="Email" value={record.email} />
        <Row label="Mobile" value={record.mobile} />
        <Row label="Phone" value={record.phone !== record.mobile ? record.phone : null} />
        <Row label={isLead ? 'Company' : 'Account'} value={record.company} />
        <Row label="Title" value={record.title} />
        <Row label="Lead status" value={record.status} />
        <Row label="Lead source" value={record.source} />
        <Row label="City" value={record.city} />
        <Row label="Created" value={when(record.created)} />
        <Row label="Last updated" value={when(record.modified)} />
        <Row label="Last activity" value={when(record.lastActivity)} />
      </div>

      {!isLead && record.deals.length > 0 && (
        <div className="mt-3">
          <p className="text-muted-foreground mb-1.5 text-[11px] font-medium">Deals</p>
          <ul className="space-y-1.5">
            {record.deals.map((deal) => {
              const amount =
                deal.amount !== null
                  ? `${deal.currency ?? ''}${deal.amount.toLocaleString('en-IN')}`
                  : null;
              const close = when(deal.closingDate, false);
              const body = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-foreground min-w-0 truncate text-sm font-medium">
                      {deal.name ?? 'Deal'}
                    </span>
                    {amount && <span className="text-foreground shrink-0 text-sm">{amount}</span>}
                  </div>
                  <div className="text-muted-foreground mt-0.5 flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate">{deal.stage ?? '—'}</span>
                    {close && <span className="shrink-0">Closes {close}</span>}
                  </div>
                </>
              );
              return (
                <li key={deal.id}>
                  {deal.url ? (
                    <a
                      href={deal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-border hover:bg-muted block rounded-lg border px-3 py-2 transition-colors"
                    >
                      {body}
                    </a>
                  ) : (
                    <div className="border-border rounded-lg border px-3 py-2">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
