import Link from 'next/link';
import { ArrowUpRight, KeyRound } from 'lucide-react';

import { AiConfig } from '@/components/agents/ai-config';
import { SettingsPanelHead } from '@/components/settings/settings-panel-head';

// Settings → AI & models (route id stays `developer-hub`).
//
// The technical half of the AI agent — which provider, whose API key,
// which model, and the behaviour that drives it. It used to live on
// /agents beside the Playground, which put credentials in the middle of
// a page whose job is "talk to the bot and see what it says". Keys and
// model ids are set up once and then forgotten, so they belong in
// Settings; /agents keeps the Playground and links here.
export default function DeveloperHubPage() {
  return (
    <div className="space-y-6">
      <SettingsPanelHead
        title="AI & models"
        description="Model provider, credentials and agent behaviour. Bring your own key — it is stored encrypted and never leaves your workspace."
        className="mb-0"
      />

      <AiConfig />

      {/* A developer who lands here for the AI key usually wants the
          REST credentials next; that lives in its own section. */}
      <Link
        href="/settings/api-access"
        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <KeyRound className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">
            API keys &amp; webhooks
          </span>
          <span className="block text-xs text-muted-foreground">
            REST credentials for connecting your own software to wacrm.
          </span>
        </span>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </div>
  );
}
