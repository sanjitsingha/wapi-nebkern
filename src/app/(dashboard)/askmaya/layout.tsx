import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';

import { MayaNav } from '@/components/agents/maya-nav';

// Maya's own module, built like Settings (see settings/layout.tsx): one
// bordered panel pinned to the available height, her pages listed on
// the left (a chip strip on phones), and a content pane that is the
// only region that scrolls.
export default function MayaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card lg:flex-row">
      <aside className="shrink-0 overflow-y-auto border-b border-border bg-card px-4 pt-4 pb-2 lg:w-60 lg:border-r lg:border-b-0 lg:px-3 lg:py-6">
        <div className="mb-3 px-1 lg:px-3">
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
            <Sparkles className="size-4 shrink-0 text-primary" />
            Maya
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Your AI agent</p>
        </div>
        <MayaNav />
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:px-10 lg:py-8">
        <div className="w-full max-w-4xl">{children}</div>
      </div>
    </div>
  );
}
