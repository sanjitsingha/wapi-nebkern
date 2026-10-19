'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowUpRight, Check, Copy, Loader2, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

// ============================================================
// Inbox → contact panel → Integrations.
//
// The person's record in each connected CRM, read live — Zoho CRM and
// HubSpot: the record they are synced with, the fields worth having
// mid-conversation, their deals, and a way in. Each connected CRM has a
// tab of its own; only fields with a value are shown.
// ============================================================

const ZOHO_LOGO = '/images/integrations/zoho-crm.png';
const HUBSPOT_LOGO = '/images/integrations/hubspot-mark.png';

interface CrmDeal {
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
  deals: CrmDeal[];
}

interface HubSpotRecord {
  id: string;
  url: string | null;
  name: string | null;
  owner: string | null;
  email: string | null;
  mobile: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  lifecycle: string | null;
  leadStatus: string | null;
  city: string | null;
  created: string | null;
  modified: string | null;
  lastActivity: string | null;
  deals: CrmDeal[];
}

type RecordState<R> =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'not-connected' }
  | { kind: 'not-synced' }
  | { kind: 'missing' }
  | { kind: 'record'; record: R };

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

/**
 * One CRM's record for a contact. Keyed by contact so switching people
 * never shows the previous person's record while the next one loads.
 */
function useCrmRecord<R>(endpoint: string, contactId: string): [RecordState<R>, () => void] {
  const [loaded, setLoaded] = useState<{ contactId: string; state: RecordState<R> } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const state: RecordState<R> = loaded?.contactId === contactId ? loaded.state : { kind: 'loading' };

  const fetchState = useCallback(async (): Promise<RecordState<R>> => {
    try {
      const res = await fetch(`${endpoint}?contact_id=${contactId}`, { cache: 'no-store' });
      const d = (await res.json().catch(() => null)) as {
        connected?: boolean;
        record?: R | null;
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
  }, [endpoint, contactId]);

  useEffect(() => {
    let cancelled = false;
    void fetchState().then((next) => {
      if (!cancelled) setLoaded({ contactId, state: next });
    });
    return () => {
      cancelled = true;
    };
  }, [fetchState, contactId, attempt]);

  const retry = useCallback(() => {
    setLoaded(null);
    setAttempt((n) => n + 1);
  }, []);
  return [state, retry];
}

export function IntegrationsTab({ contactId }: { contactId: string }) {
  const [zoho, retryZoho] = useCrmRecord<ZohoRecord>('/api/integrations/zoho/record', contactId);
  const [hubspot, retryHubSpot] = useCrmRecord<HubSpotRecord>(
    '/api/integrations/hubspot/record',
    contactId,
  );
  // Which connected CRM is showing; the first one until another is picked.
  const [picked, setPicked] = useState<'zoho' | 'hubspot' | null>(null);

  if (zoho.kind === 'loading' || hubspot.kind === 'loading') {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="text-muted-foreground size-4 animate-spin" />
      </div>
    );
  }

  if (zoho.kind === 'not-connected' && hubspot.kind === 'not-connected') {
    return (
      <div className="px-4 py-3">
        <div className="border-border rounded-lg border p-3 text-center">
          <p className="text-muted-foreground text-xs">No CRM is connected.</p>
          <Link
            href="/settings/integrations"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-2')}
          >
            Connect HubSpot or Zoho CRM
          </Link>
        </div>
      </div>
    );
  }

  // One tab per connected CRM.
  const crms = (
    [
      { key: 'zoho', name: 'Zoho CRM', logo: ZOHO_LOGO, connected: zoho.kind !== 'not-connected' },
      { key: 'hubspot', name: 'HubSpot', logo: HUBSPOT_LOGO, connected: hubspot.kind !== 'not-connected' },
    ] as const
  ).filter((c) => c.connected);
  const current = crms.find((c) => c.key === picked) ?? crms[0];

  return (
    <div className="px-4 py-3">
      <div
        role="tablist"
        aria-label="Connected integrations"
        className="bg-muted mb-3 flex gap-0.5 rounded-lg p-0.5"
      >
        {crms.map((c) => {
          const active = c.key === current.key;
          return (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPicked(c.key)}
              className={cn(
                'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.logo} alt="" className="h-3.5 w-auto shrink-0 object-contain" />
              <span className="truncate">{c.name}</span>
            </button>
          );
        })}
      </div>

      {current.key === 'zoho' ? (
        <CrmSection name="Zoho CRM" state={zoho} onRetry={retryZoho}>
          {(record) => <ZohoRecordView record={record} />}
        </CrmSection>
      ) : (
        <CrmSection name="HubSpot" state={hubspot} onRetry={retryHubSpot}>
          {(record) => <HubSpotRecordView record={record} />}
        </CrmSection>
      )}
    </div>
  );
}

function CrmSection<R>({
  name,
  state,
  onRetry,
  children,
}: {
  name: string;
  state: RecordState<R>;
  onRetry: () => void;
  children: (record: R) => ReactNode;
}) {
  return (
    <div role="tabpanel">
      {state.kind === 'error' && (
        <div className="border-border rounded-lg border p-3 text-center">
          <p className="text-muted-foreground text-xs">Couldn&apos;t load this from {name}.</p>
          <button
            type="button"
            onClick={onRetry}
            className="text-primary mt-2 inline-flex items-center gap-1 text-xs font-medium hover:underline"
          >
            <RefreshCw className="size-3" />
            Try again
          </button>
        </div>
      )}

      {state.kind === 'not-synced' && (
        <p className="border-border text-muted-foreground rounded-lg border p-3 text-center text-xs">
          Not in {name} yet.
        </p>
      )}

      {state.kind === 'missing' && (
        <p className="border-border text-muted-foreground rounded-lg border p-3 text-center text-xs">
          This record was deleted in {name}.
        </p>
      )}

      {state.kind === 'record' && children(state.record)}
    </div>
  );
}

/** The record's heading card: name, its kind, its id (copyable) and a
 *  way into the CRM. */
function RecordCard({
  name,
  badge,
  idLabel,
  id,
  url,
  openLabel,
}: {
  name: string | null;
  badge: string;
  idLabel: string;
  id: string;
  url: string | null;
  openLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (permissions); the id is on screen to select.
    }
  };
  return (
    <div className="border-border rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-foreground min-w-0 truncate text-sm font-semibold">{name ?? 'Unnamed'}</p>
        <span className="border-primary/30 bg-primary-soft text-primary shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium">
          {badge}
        </span>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        title={`Copy ${idLabel}`}
        className="text-muted-foreground hover:text-foreground mt-1 inline-flex max-w-full items-center gap-1.5 text-[11px]"
      >
        <span className="truncate font-mono">
          {idLabel} {id}
        </span>
        {copied ? <Check className="text-primary size-3 shrink-0" /> : <Copy className="size-3 shrink-0" />}
      </button>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ size: 'sm' }), 'mt-3 w-full')}
        >
          {openLabel}
          <ArrowUpRight className="size-3.5" />
        </a>
      )}
    </div>
  );
}

function DealList({ deals }: { deals: CrmDeal[] }) {
  if (deals.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-muted-foreground mb-1.5 text-[11px] font-medium">Deals</p>
      <ul className="space-y-1.5">
        {deals.map((deal) => {
          const amount =
            deal.amount !== null ? `${deal.currency ?? ''}${deal.amount.toLocaleString('en-IN')}` : null;
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
  );
}

function ZohoRecordView({ record }: { record: ZohoRecord }) {
  const isLead = record.module === 'Leads';
  return (
    <>
      <RecordCard
        name={record.name}
        badge={isLead ? 'Lead' : 'Contact'}
        idLabel="Zoho ID"
        id={record.id}
        url={record.url}
        openLabel="Open in Zoho"
      />
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
      {!isLead && <DealList deals={record.deals} />}
    </>
  );
}

function HubSpotRecordView({ record }: { record: HubSpotRecord }) {
  return (
    <>
      <RecordCard
        name={record.name}
        badge={record.lifecycle ?? 'Contact'}
        idLabel="HubSpot ID"
        id={record.id}
        url={record.url}
        openLabel="Open in HubSpot"
      />
      <div className="mt-2">
        <Row label="Owner" value={record.owner} />
        <Row label="Email" value={record.email} />
        <Row label="Mobile" value={record.mobile} />
        <Row label="Phone" value={record.phone !== record.mobile ? record.phone : null} />
        <Row label="Company" value={record.company} />
        <Row label="Job title" value={record.title} />
        <Row label="Lead status" value={record.leadStatus} />
        <Row label="City" value={record.city} />
        <Row label="Created" value={when(record.created)} />
        <Row label="Last updated" value={when(record.modified)} />
        <Row label="Last activity" value={when(record.lastActivity)} />
      </div>
      <DealList deals={record.deals} />
    </>
  );
}
