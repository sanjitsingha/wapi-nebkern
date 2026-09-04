'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowUpRight, Check, ChevronDown, Copy, Zap } from 'lucide-react';

import { cn } from '@/lib/utils';
import { allSamples } from '@/lib/webhooks/samples';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ============================================================
// Settings → Integrations → Zapier.
//
// Instant has no app in Zapier's directory (that listing is gated on
// having ten active users first), so every customer wires this up by
// hand: a Catch Hook on Zapier's side, an endpoint on ours. That path
// works today and is not hard — it was just undocumented in the one
// place someone is standing when they try it. The card used to link out
// to /docs/api-and-integrations, which is a reference, not a recipe.
//
// The sample payloads are the point. A Zapier "Catch Hook" step shows
// no fields until it has received something, so the usual next move is
// to go and trigger a real event on a live WhatsApp number just to
// learn what `contact_id` is called. Reading it here instead skips
// that, and skips getting it wrong.
// ============================================================

export function ZapierConnect() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="border-border bg-card hover:border-foreground/20 flex flex-col rounded-xl border p-4 transition-colors">
        <span className="flex size-11 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
          <Zap className="size-5" />
        </span>
        <h4 className="text-foreground mt-3 text-sm font-semibold">Zapier</h4>
        <p className="text-muted-foreground mt-1 flex-1 text-xs leading-relaxed">
          Connect Instant to 6,000+ apps with no code, using your API key and
          webhooks.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-4 w-full"
          onClick={() => setOpen(true)}
        >
          Setup guide
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* `*:min-w-0` — DialogContent is a CSS grid; without it the wide
            payload blocks push the dialog past the viewport instead of
            scrolling inside their own box. Same fix as ZohoConnect. */}
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl *:min-w-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <Zap className="size-4" />
              </span>
              Connect Zapier
            </DialogTitle>
            <DialogDescription>
              There is no Instant app to install — Zapier&apos;s built-in
              Webhooks step does both directions.
            </DialogDescription>
          </DialogHeader>

          <ZapierGuideBody onGoToWebhooks={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ZapierGuideBody({ onGoToWebhooks }: { onGoToWebhooks: () => void }) {
  const [openSample, setOpenSample] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('Could not copy — select the text and copy it manually.');
    }
  };

  const samples = allSamples();

  return (
    <div className="space-y-5">
      {/* ── Receiving events from Instant ── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-foreground text-xs font-semibold tracking-wide uppercase">
            To start a Zap when something happens here
          </h3>
          <a
            href="https://zapier.com/app/editor"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium"
          >
            Open Zapier
            <ArrowUpRight className="size-3.5" />
          </a>
        </div>

        <ol className="text-muted-foreground mt-2.5 space-y-2 text-xs leading-relaxed">
          <Step n={1}>
            In Zapier, create a Zap and choose{' '}
            <Strong>Webhooks by Zapier</Strong> as the trigger, then{' '}
            <Strong>Catch Hook</Strong>.
          </Step>
          <Step n={2}>
            Copy the <Strong>Custom Webhook URL</Strong> it gives you.
          </Step>
          <Step n={3}>
            Paste it into{' '}
            <a
              href="#webhooks"
              onClick={onGoToWebhooks}
              className="text-primary hover:underline"
            >
              Outbound webhooks
            </a>{' '}
            further down this page, tick the events you want, and press{' '}
            <Strong>Send test</Strong>. Zapier will catch that test and learn
            the fields.
          </Step>
        </ol>

        {/* Sample payloads — the part that saves a real send. */}
        <div className="mt-3.5">
          <p className="text-muted-foreground mb-1.5 text-[11px]">
            What each event looks like, if you would rather read than fire one:
          </p>
          <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
            {samples.map((s) => {
              const isOpen = openSample === s.type;
              return (
                <div key={s.type}>
                  <button
                    type="button"
                    onClick={() => setOpenSample(isOpen ? null : s.type)}
                    aria-expanded={isOpen}
                    className="hover:bg-muted/50 flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
                  >
                    <ChevronDown
                      className={cn(
                        'text-muted-foreground size-3.5 shrink-0 transition-transform',
                        isOpen && 'rotate-180',
                      )}
                    />
                    <span className="text-foreground min-w-0 flex-1 truncate text-xs font-medium">
                      {s.label}
                    </span>
                    <code className="text-muted-foreground shrink-0 font-mono text-[10px]">
                      {s.type}
                    </code>
                  </button>
                  {isOpen && (
                    <div className="border-border bg-muted/30 border-t px-3 py-2.5">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-muted-foreground text-[11px]">
                          {s.description}
                        </span>
                        <button
                          type="button"
                          onClick={() => copy(s.type, s.json)}
                          className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-[11px] font-medium transition-colors"
                        >
                          {copied === s.type ? (
                            <Check className="size-3" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                          Copy
                        </button>
                      </div>
                      <pre className="text-foreground overflow-x-auto text-[10px] leading-relaxed">
                        {s.json}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Sending back into Instant ── */}
      <div className="border-border border-t pt-5">
        <h3 className="text-foreground text-xs font-semibold tracking-wide uppercase">
          To do something here from a Zap
        </h3>
        <ol className="text-muted-foreground mt-2.5 space-y-2 text-xs leading-relaxed">
          <Step n={1}>
            Add a <Strong>Webhooks by Zapier</Strong> action and choose{' '}
            <Strong>POST</Strong>.
          </Step>
          <Step n={2}>
            Under <Strong>Headers</Strong>, add <Code>x-api-key</Code> with your
            key as the value — it starts <Code>wak_</Code>. Not an{' '}
            <Code>Authorization: Bearer</Code> header; this API reads the key
            from <Code>x-api-key</Code> only. Generate one under{' '}
            <a
              href="/settings/api-access"
              className="text-primary hover:underline"
            >
              API access
            </a>
            .
          </Step>
          <Step n={3}>
            Set <Strong>Payload Type</Strong> to <Strong>json</Strong>, then set
            the URL and fields for what you want to do:
          </Step>
        </ol>

        <div className="mt-3 flex flex-col gap-2">
          {ACTIONS.map((a) => (
            <ActionCard key={a.path} action={a} onCopy={copy} copied={copied} />
          ))}
        </div>
      </div>

      {/* Verifying a delivery really came from us. Worth saying plainly:
          the header goes out on every request and is quietly ignored by
          most people, which is fine right up until it is not. */}
      <p className="text-muted-foreground border-border border-t pt-4 text-[11px] leading-relaxed">
        Every event we send carries an <Code>X-Wacrm-Signature</Code> header —
        an HMAC-SHA256 of the body, using the secret shown when you create the
        endpoint. Zapier does not check it for you. For a Zap that only moves
        data around that is usually fine; verify it if the Zap does anything you
        would not want a stranger triggering.
      </p>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="bg-muted text-foreground mt-px flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold">
        {n}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="text-foreground font-medium">{children}</span>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted text-foreground rounded px-1">{children}</code>
  );
}

// The two write endpoints, with a body that actually works. Copied from
// the docblocks on each route — if a route's contract changes, this is
// the other place to change.
//
// Worth being blunt about the first one: it sends an approved template,
// not free text. Someone arriving from a generic "send a message"
// webhook will otherwise POST { message: "..." } and get back a 400
// naming a field they have never heard of.
const ACTIONS: {
  path: string;
  title: string;
  note: string;
  scope?: string;
  body: string;
}[] = [
  {
    path: '/api/v1/messages',
    title: 'Send a WhatsApp template',
    note: 'Approved templates only — WhatsApp does not allow free text unless the contact messaged you in the last 24 hours. The params array fills the numbered placeholders in order.',
    scope: 'send:messages',
    body: `{
  "to": "+919876543210",
  "template": { "name": "order_shipped", "language": "en_US" },
  "params": ["Priya", "BLR-4471"]
}`,
  },
  {
    path: '/api/v1/contacts',
    title: 'Create or update a contact',
    note: 'Idempotent by phone — an existing contact is returned and its name updated, never duplicated. The name field is optional.',
    body: `{
  "phone": "+919876543210",
  "name": "Priya Raman"
}`,
  },
];

function ActionCard({
  action,
  onCopy,
  copied,
}: {
  action: (typeof ACTIONS)[number];
  onCopy: (key: string, text: string) => void;
  copied: string | null;
}) {
  // Built from the browser's origin rather than an env var: this has to
  // be the host the customer is actually on, and it differs between a
  // tunnel, staging and production.
  const url =
    typeof window === 'undefined'
      ? action.path
      : `${window.location.origin}${action.path}`;

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <div className="bg-muted/40 flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
        <span className="text-foreground text-xs font-medium">
          {action.title}
        </span>
        {action.scope && (
          <span className="text-muted-foreground border-border rounded border px-1 font-mono text-[10px]">
            needs {action.scope}
          </span>
        )}
      </div>

      <div className="border-border flex items-center gap-2 border-t px-3 py-1.5">
        <span className="text-muted-foreground shrink-0 font-mono text-[10px] font-semibold">
          POST
        </span>
        <code className="text-foreground min-w-0 flex-1 truncate font-mono text-[10px]">
          {url}
        </code>
        <button
          type="button"
          onClick={() => onCopy(action.path, url)}
          aria-label={`Copy URL for ${action.title}`}
          className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
        >
          {copied === action.path ? (
            <Check className="size-3" />
          ) : (
            <Copy className="size-3" />
          )}
        </button>
      </div>

      <div className="border-border bg-muted/20 border-t px-3 py-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
            Body
          </span>
          <button
            type="button"
            onClick={() => onCopy(`${action.path}:body`, action.body)}
            className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-[11px] font-medium transition-colors"
          >
            {copied === `${action.path}:body` ? (
              <Check className="size-3" />
            ) : (
              <Copy className="size-3" />
            )}
            Copy
          </button>
        </div>
        <pre className="text-foreground overflow-x-auto text-[10px] leading-relaxed">
          {action.body}
        </pre>
        <p className="text-muted-foreground mt-1.5 text-[11px] leading-relaxed">
          {action.note}
        </p>
      </div>
    </div>
  );
}
