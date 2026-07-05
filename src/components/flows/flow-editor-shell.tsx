'use client';

/**
 * Flow editor shell — a full-screen, distraction-free canvas editor.
 *
 * The canvas is the only view (the old Canvas/List toggle was removed).
 * The trigger config, which used to live in the list view, is reached
 * from a button in the header (`EditorHeader`) that opens it in a modal.
 */

import { FlowCanvas } from './flow-canvas';
import { FlowEditorProvider } from './flow-editor-state';
import { EditorHeader } from './header';
import type { FlowRow, FlowNodeRow } from '@/lib/flows/types';

interface Props {
  initialFlow: FlowRow;
  initialNodes: FlowNodeRow[];
}

export function FlowEditorShell({ initialFlow, initialNodes }: Props) {
  return (
    <FlowEditorProvider initialFlow={initialFlow} initialNodes={initialNodes}>
      {/* Full-screen editor overlay — covers the app sidebar + header so
          the builder gets a distraction-free, single-chrome canvas. */}
      <div className="fixed inset-0 flex flex-col bg-background">
        <header className="shrink-0 border-b border-border bg-card/80 px-3 py-2.5 sm:px-4">
          <EditorHeader />
        </header>

        <main className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden">
            <FlowCanvas />
          </div>
        </main>
      </div>
    </FlowEditorProvider>
  );
}
