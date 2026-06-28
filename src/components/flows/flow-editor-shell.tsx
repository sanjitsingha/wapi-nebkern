'use client';

/**
 * View-switcher for the flow editor.
 *
 * Renders a small Canvas / List pill above whichever view is active,
 * and conditionally mounts `<FlowCanvas>` or `<FlowBuilder>`. Why a
 * separate component:
 *   - The page itself stays trivially small (loading + error + this).
 *   - Either view can stay unaware of the other — they share data
 *     (`{flow, nodes}`) and nothing else.
 *
 * View choice persists per-browser via localStorage so a power user
 * who prefers the list isn't fighting the default on every load.
 * Canvas is the default for everyone else — the original user
 * feedback was that the list shape made flows "hard to understand".
 */

import { useEffect, useState } from 'react';
import { LayoutGrid, ListTree } from 'lucide-react';

import { FlowBuilder } from './flow-builder';
import { FlowCanvas } from './flow-canvas';
import { FlowEditorProvider } from './flow-editor-state';
import { EditorHeader } from './header';
import { ValidationPanel } from './validation-panel';
import { cn } from '@/lib/utils';
import type { FlowRow, FlowNodeRow } from '@/lib/flows/types';

/**
 * Below this viewport width we force list view and hide the toggle.
 * Canvas with drag-to-connect on a phone is unusable — handles are
 * ~10px and live finger drags from one node to another aren't a
 * practical workflow. Matches Tailwind's `md` breakpoint.
 */
const MOBILE_BREAKPOINT = '(max-width: 767px)';

type View = 'canvas' | 'list';

const STORAGE_KEY = 'wacrm.flowEditor.view';

interface Props {
  initialFlow: FlowRow;
  initialNodes: FlowNodeRow[];
}

export function FlowEditorShell({ initialFlow, initialNodes }: Props) {
  // Read the persisted choice in the useState initializer. Safe even
  // though this is a client component because the parent page only
  // mounts us AFTER a client-side fetch resolves — there's no SSR
  // pass for this subtree, so no hydration mismatch to worry about.
  // Default to `canvas` (the new default) when nothing is saved.
  const [view, setView] = useState<View>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'canvas' || saved === 'list') return saved;
    } catch {
      // Private browsing / disabled storage — fall through to default.
    }
    return 'canvas';
  });

  // Live mobile detection. We don't render canvas under the
  // breakpoint regardless of `view` — but we keep `view` itself
  // intact so the user's preference comes back when they widen
  // again (e.g. rotating a tablet, resizing a window).
  const isMobile = useMatchMedia(MOBILE_BREAKPOINT);
  const effectiveView: View = isMobile ? 'list' : view;

  const choose = (next: View) => {
    setView(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  return (
    <FlowEditorProvider initialFlow={initialFlow} initialNodes={initialNodes}>
      <div className="mx-auto flex min-h-screen w-full max-w-full flex-col">
        <header className="border-b border-border bg-card p-6">
          <EditorHeader />
        </header>

        <main className="flex h-full w-full flex-1 flex-col gap-6 p-6">
          {!isMobile && (
            <div className="flex items-center justify-end">
              <div
                role="group"
                aria-label="Editor view"
                className="border-border bg-card inline-flex items-center gap-1 rounded-md border p-0.5 text-xs"
              >
                <ToggleButton
                  active={effectiveView === 'canvas'}
                  onClick={() => choose('canvas')}
                  icon={<LayoutGrid className="h-3 w-3" />}
                  label="Canvas"
                />
                <ToggleButton
                  active={effectiveView === 'list'}
                  onClick={() => choose('list')}
                  icon={<ListTree className="h-3 w-3" />}
                  label="List"
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-hidden">
            {effectiveView === 'canvas' ? <FlowCanvas /> : <FlowBuilder />}
          </div>

          <div className="shadow-background/60 sticky bottom-4 z-10 shadow-xl">
            <ValidationPanel />
          </div>
        </main>
      </div>
    </FlowEditorProvider>
  );
}

/**
 * Tiny `useMatchMedia` shim. We could pull in `react-responsive` but
 * this is the only consumer and matchMedia is one of those browser
 * APIs that doesn't need a dependency.
 */
function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    // Safari < 14 still uses addListener; addEventListener is the
    // modern path. Both fire identically.
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2 py-1 transition-colors',
        active
          ? 'bg-secondary text-secondary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {icon}
      {label}
    </button>
  );
}
