'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ChevronRight,
  ExternalLink,
  MessagesSquare,
  SlidersHorizontal,
  UserRound,
  Video,
  type LucideIcon,
} from 'lucide-react';

import { useCan } from '@/hooks/use-can';
import { Button } from '@/components/ui/button';
import { MayaPowerCard } from '@/components/agents/maya-power-card';
import { SettingsPanelHead } from '@/components/settings/settings-panel-head';

/** A walkthrough video, once there is one — the button shows then. */
const TUTORIAL_URL: string | null = null;

/** Maya's pages, as cards. Each opens the page in her side panel. */
const SECTIONS: { href: string; title: string; description: string; icon: LucideIcon }[] = [
  {
    href: '/askmaya/configuration',
    title: 'Activation',
    description:
      'Controls when Maya responds — activation rules, chat mode, response delay and operating hours.',
    icon: SlidersHorizontal,
  },
  {
    href: '/askmaya/personalization',
    title: 'Personalization',
    description: 'Who Maya is — her personality, her role and the topics she avoids.',
    icon: UserRound,
  },
  {
    href: '/askmaya/knowledge-base',
    title: 'Knowledge base',
    description: 'What Maya answers from — your policies, Q&A and files.',
    icon: BookOpen,
  },
  {
    href: '/askmaya/playground',
    title: 'Playground',
    description: 'Chat with Maya as a customer would, before she talks to real ones.',
    icon: MessagesSquare,
  },
];

interface Summary {
  /** Instant's AI is ready (Admin → AI model). */
  configured: boolean;
  is_active?: boolean;
  auto_reply_enabled?: boolean;
}

/** Maya → Overview: her on/off switch, and a card into each of her pages. */
export default function AskMayaPage() {
  const canEdit = useCan('edit-settings');
  const [loaded, setLoaded] = useState(false);
  const [summary, setSummary] = useState<Summary>({ configured: false });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/config');
      const data = await res.json().catch(() => ({}));
      setSummary({
        configured: !!data?.configured,
        is_active: data?.is_active,
        auto_reply_enabled: data?.auto_reply_enabled,
      });
    } catch {
      setSummary({ configured: false });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return (
    // No width cap of its own: Maya's layout holds its content pane to
    // max-w-4xl and supplies the padding.
    <div>
      <SettingsPanelHead
        title="Overview"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href="/docs/ai-agents" target="_blank" rel="noopener noreferrer" />}
            >
              Go to documentation
              <ExternalLink className="size-3.5" />
            </Button>
            {TUTORIAL_URL && (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<a href={TUTORIAL_URL} target="_blank" rel="noopener noreferrer" />}
              >
                <Video className="size-3.5" />
                Watch tutorial
              </Button>
            )}
          </div>
        }
      />

      {/* The on/off switch first: whether she is answering customers is
          the one thing to know before anything else on the page. */}
      {loaded ? (
        <MayaPowerCard
          configured={summary.configured}
          isActive={summary.is_active === true}
          autoReplyEnabled={summary.auto_reply_enabled === true}
          canEdit={canEdit}
          onChanged={refresh}
        />
      ) : (
        <div className="h-[74px] animate-pulse rounded-xl border border-border bg-card" />
      )}

      <section aria-labelledby="maya-config-heading" className="mt-8">
        <h2 id="maya-config-heading" className="text-sm font-semibold text-foreground">
          Configuration
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          These settings determine how Maya responds. Select a card to configure it.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {SECTIONS.map(({ href, title, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/20 hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <Icon className="size-[18px] shrink-0 text-muted-foreground" />
                <span className="flex-1 text-sm font-semibold text-foreground">{title}</span>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
