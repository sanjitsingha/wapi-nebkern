'use client';

import { InfoHint } from '@/components/ui/info-hint';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Settings2, Sparkles } from 'lucide-react';
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

/**
 * Maya's accent, as a colour value rather than a Tailwind class so it
 * can be fed through `color-mix` the way the landing page's washes are.
 * Tailwind's violet-500, which is what the "New" badge already uses.
 */
const MAYA_HUE = 'oklch(0.606 0.25 292.717)';

/**
 * The hero's wash, built the way the landing page builds its panels:
 * one hue mixed into the page colour, strongest at the bottom edge and
 * dissolving out before the top rather than stopping on a hard line.
 *
 * `var(--card)` stands in for the landing page's literal `#fff`. That
 * page is light-only so it can hard-code white; this one reads a token,
 * which is the same white today and would follow a dark theme if one is
 * ever added.
 *
 * 16% because violet at full strength is far heavier than the lemon and
 * grass the landing page mixes at 20–30% — the same number here would
 * read as a purple panel rather than a tint.
 */
const HERO_WASH = `linear-gradient(to top, color-mix(in oklab, ${MAYA_HUE} 16%, var(--card)), var(--card) 78%)`;

export default function AskMayaPage() {
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
      {/* ── Hero ──
          Maya is the one surface in the app with a personality, so she
          gets a panel rather than the standard title-and-subtitle row
          every other page opens with. The colour is contained inside
          this card and stops at its edge — the dashboard around it stays
          neutral, which is what keeps this reading as emphasis rather
          than as a different product. */}
      {/* One flat wash, no blurred blobs. The landing page gets its
          colour from a single mixed gradient held to the panel, and
          stacking glows on top of that is a different, busier idiom. */}
      <section
        className="border-border bg-card relative overflow-hidden rounded-2xl border"
        style={{ backgroundImage: HERO_WASH }}
      >
        <div className="relative flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="flex items-start gap-4">
            {/* The avatar carries the gradient at full strength — one
                saturated object gives the eye somewhere to land, which a
                wash spread evenly across the whole panel cannot. */}
            {/* The one saturated object on the panel. The wash behind it
                is a tint, so without something at full strength the hero
                has no anchor — two stops, same violet the wash is mixed
                from, running into the brand green. */}
            <span className="to-primary flex size-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-violet-500 text-white shadow-lg shadow-violet-500/25">
              <Sparkles className="size-7" strokeWidth={2} />
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-foreground text-3xl font-bold tracking-tight">
                  Maya
                </h1>
                <span className="inline-flex items-center rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-violet-600 uppercase dark:text-violet-300">
                  New
                </span>
                <InfoHint label="Maya" docs="/docs/ai-agents">
                  Maya answers from a knowledge base you give her — your
                  catalogue, policies and FAQs — and hands the conversation to
                  a human the moment she is out of her depth.
                </InfoHint>
              </div>
              <p className="text-muted-foreground mt-1.5 max-w-xl text-sm leading-relaxed">
                Your AI teammate on WhatsApp. Bring your own model key, set her
                up once, then test her in the Playground before she replies to
                a real customer.
              </p>
            </div>
          </div>

          {decided && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold',
                status.cls,
              )}
            >
              {/* The dot only pulses when she is actually answering
                  customers. A permanently animated indicator stops
                  meaning anything. */}
              <span className="relative flex size-1.5">
                {summary.configured && summary.is_active && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-75" />
                )}
                <span className="relative inline-flex size-1.5 rounded-full bg-current" />
              </span>
              {status.label}
            </span>
          )}
        </div>
      </section>

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
            {/* The hairline across the top is the hero's gradient again
                at card scale — enough to tie the two together without a
                second washed panel competing with it. */}
            <div className="border-border bg-card relative overflow-hidden rounded-2xl border p-5">
              <div
                aria-hidden
                className="to-primary pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-violet-500"
              />
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300">
                  <Settings2 className="size-4" />
                </span>
                <h2
                  id="agent-setup-heading"
                  className="text-foreground text-sm font-semibold"
                >
                  Setup
                </h2>
              </div>

              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                {summary.configured
                  ? 'Maya is connected. Change the provider, key, model or behaviour in the Developer hub.'
                  : 'Connect a model provider with your own API key to bring Maya to life.'}
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

              {/* Unconfigured, this is the only thing on the page worth
                  doing, so it wears the gradient. Once she is set up it
                  drops back to an outline — at that point the Playground
                  beside it is the point of the page, and two competing
                  primaries would just be noise. */}
              <Button
                render={<Link href="/settings/developer-hub" />}
                className={cn(
                  'mt-5 h-11 w-full',
                  !summary.configured &&
                    'to-primary border-0 bg-linear-to-r from-violet-500 text-white shadow-md shadow-violet-500/25 hover:opacity-90',
                )}
                variant={summary.configured ? 'outline' : 'default'}
              >
                <Settings2 className="size-4" />
                {summary.configured ? 'Configure Maya' : 'Set up Maya'}
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
