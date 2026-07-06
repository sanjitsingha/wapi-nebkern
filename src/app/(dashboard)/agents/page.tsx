'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, Sparkles, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AiPlayground } from '@/components/agents/ai-playground';
import { AiConfig } from '@/components/agents/ai-config';
import type { AiProvider } from '@/lib/ai/types';

type Tab = 'playground' | 'setup';

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
  const [tab, setTab] = useState<Tab>('playground');
  const [decided, setDecided] = useState(false);
  const [summary, setSummary] = useState<Summary>({ configured: false });

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

  // Land first-time users on Setup, returning users on the Playground.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const configured = await refresh();
      if (!cancelled) {
        setTab(configured ? 'playground' : 'setup');
        setDecided(true);
      }
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
    <div className="mx-auto max-w-4xl">
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
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          className="mt-6"
        >
          <TabsList>
            <TabsTrigger value="playground">
              <Sparkles className="mr-1.5 h-4 w-4" /> Playground
            </TabsTrigger>
            <TabsTrigger value="setup">
              <Settings2 className="mr-1.5 h-4 w-4" /> Setup
            </TabsTrigger>
          </TabsList>

          <TabsContent value="playground" className="mt-4">
            <AiPlayground
              onGoToSetup={() => setTab('setup')}
              subtitle={agentSubtitle}
              configured={summary.configured}
            />
          </TabsContent>

          <TabsContent value="setup" className="mt-4">
            <AiConfig onSaved={refresh} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
