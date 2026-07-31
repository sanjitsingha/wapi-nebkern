'use client';

import { InfoHint } from '@/components/ui/info-hint';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AiPlayground } from '@/components/agents/ai-playground';
import type { AiProvider } from '@/lib/ai/types';

/** Where the technical setup moved to. */
const SETUP_HREF = '/settings/developer-hub';

interface Summary {
  configured: boolean;
  is_active?: boolean;
  provider?: AiProvider;
  model?: string;
}

const PROVIDER_LABEL: Record<AiProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
};

export default function AgentsPage() {
  const router = useRouter();
  const [decided, setDecided] = useState(false);
  const [summary, setSummary] = useState<Summary>({ configured: false });

  /** The playground's "set this up first" CTA — same destination as the
   *  Configure button beside it. */
  const goToSetup = useCallback(() => {
    router.push(SETUP_HREF);
  }, [router]);

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/ai/config');
      const data = await res.json().catch(() => ({}));
      setSummary({
        configured: !!data?.configured,
        is_active: data?.is_active,
        provider: data?.provider,
        model: data?.model,
      });
      return !!data?.configured;
    } catch {
      setSummary({ configured: false });
      return false;
    }
  }, []);

  // Both panels render together now, so there's no tab to preselect —
  // `decided` just holds the layout back until we know whether the agent
  // is configured, which drives the stacked order and the status pill.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setDecided(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const agentSubtitle =
    summary.configured && summary.provider
      ? `${PROVIDER_LABEL[summary.provider]} · ${summary.model}`
      : undefined;

  const status: { label: string; cls: string } = !summary.configured
    ? {
        label: 'Not set up',
        cls: 'border-border bg-muted text-muted-foreground',
      }
    : summary.is_active
      ? {
          label: 'Live',
          cls: 'border-emerald-600/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
        }
      : {
          label: 'Test mode',
          cls: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300',
        };

  return (
    // Was capped at max-w-4xl for a single tabbed column. Now the
    // playground runs the full content width with Setup docked beside
    // it; the shell already supplies the page padding.
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
            <Bot className="h-6 w-6" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">
                AI Agents
              </h1>
              <span className="inline-flex items-center rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">
                New
              </span>
              <InfoHint label="AI Agents" docs="/docs/ai-agents">
                An agent answers from a knowledge base you give it — your
                catalogue, policies and FAQs — and hands the conversation to a
                human the moment it is out of its depth.
              </InfoHint>
            </div>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              A bring-your-own-key AI agent — set it up, then test it in the
              Playground before it replies to customers.
            </p>
          </div>
        </div>

        {decided && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
              status.cls,
            )}
          >
            <span className="size-1.5 rounded-full bg-current" />
            {status.label}
          </span>
        )}
      </div>

      {decided && (
        // Playground and Setup side by side rather than behind tabs —
        // they're used together (change a setting, retest immediately),
        // and a tab switch made you lose the conversation you were
        // judging the change against.
        //
        // `items-start` matters: without it both columns stretch to the
        // tallest, which breaks the sticky below.
        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* `min-w-0` — a grid child defaults to min-content width, so
              without it the chat bubbles refuse to shrink and push the
              column past its track. */}
          <div
            className={cn(
              'min-w-0',
              // Unconfigured and stacked (below xl): put Setup first,
              // since there is nothing to play with yet. Keeps the old
              // "land first-timers on Setup" behaviour without tabs.
              !summary.configured && 'order-2 xl:order-0',
            )}
          >
            <AiPlayground
              onGoToSetup={goToSetup}
              subtitle={agentSubtitle}
              configured={summary.configured}
            />
          </div>

          {/* Setup is a summary + a way in, not the form itself — the
              provider, key and model live in Settings → Developer hub.
              They're set once and then never touched, so keeping them
              here put credentials in the middle of the page you use to
              chat with the bot. */}
          <aside
            aria-labelledby="agent-setup-heading"
            className={cn(
              'min-w-0',
              !summary.configured && 'order-1 xl:order-0',
            )}
          >
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <h2
                  id="agent-setup-heading"
                  className="text-sm font-semibold text-foreground"
                >
                  Setup
                </h2>
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                {summary.configured
                  ? 'Your agent is connected. Change the provider, key, model or behaviour in the Developer hub.'
                  : 'Connect a model provider with your own API key to bring this agent to life.'}
              </p>

              {summary.configured && (
                <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Provider</dt>
                    <dd className="font-medium text-foreground">
                      {summary.provider
                        ? PROVIDER_LABEL[summary.provider]
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="shrink-0 text-muted-foreground">Model</dt>
                    <dd className="truncate font-medium text-foreground">
                      {summary.model ?? '—'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Mode</dt>
                    <dd className="font-medium text-foreground">
                      {summary.is_active ? 'Live' : 'Test only'}
                    </dd>
                  </div>
                </dl>
              )}

              <Button
                render={<Link href="/settings/developer-hub" />}
                className="mt-5 h-11 w-full"
                variant={summary.configured ? 'outline' : 'default'}
              >
                <Settings2 className="h-4 w-4" />
                {summary.configured ? 'Configure agent' : 'Set up your agent'}
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
