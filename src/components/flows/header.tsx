'use client';

/**
 * Editor header — flow name, status badge, dirty indicator, and the
 * action buttons (Save, Activate/Pause, Delete, View runs, Back).
 *
 * Lifted out of flow-builder.tsx so the same header renders above
 * both views in FlowEditorShell. Without this, canvas users had no
 * way to save without toggling to list view.
 *
 * Reads everything from the editor context (`useFlowEditor`) so it
 * stays in sync with whichever view is mutating state, and routes
 * router navigation locally (back to /flows, View runs to
 * /flows/[id]/runs) — those don't belong in the hook.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  History,
  Loader2,
  MoreVertical,
  PauseCircle,
  PlayCircle,
  Save,
  Trash2,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useFlowEditor, type BuilderState } from './flow-editor-state';
import { TriggerConfigForm, triggerSummary } from './trigger-config';

// Single-row editor top bar: back · name · status · primary actions
// (Activate/Pause, Save) · overflow menu (Runs, Delete). The
// full-screen shell provides the border + padding, so this stays a
// borderless, compact bar.
export function EditorHeader() {
  const router = useRouter();
  const {
    flow,
    state,
    setState,
    dirty,
    saving,
    activating,
    canActivate,
    save,
    setStatus,
    deleteFlow,
  } = useFlowEditor();

  const [triggerOpen, setTriggerOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => router.push('/flows')}
        aria-label="Back to flows"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4.5 w-4.5" />
      </button>

      <span aria-hidden className="hidden h-6 w-px shrink-0 bg-border sm:block" />

      {/* Name only.
          The description input lived under this and is gone — a second
          field nobody filled in, taking a row of the header on every
          flow. `flows.description` still exists on the row and anything
          already written is preserved; it is simply no longer offered
          for editing here. */}
      <div className="ml-0.5 flex min-w-0 flex-1 items-center gap-2">
        <input
          value={state.name}
          onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
          placeholder="Flow name"
          // No focus background. `focus:bg-muted` painted a grey slab
          // behind the title the moment it was clicked, which read as
          // something having gone wrong rather than as a field being
          // ready. The caret is enough to show it is editable.
          className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none sm:text-base"
        />
        <StatusBadge status={state.status} />
        {dirty && (
          <span
            className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium tracking-wide text-amber-500 uppercase"
            title="Unsaved changes — hit Save to persist"
            aria-live="polite"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span className="hidden sm:inline">Edited</span>
          </span>
        )}
      </div>

      {/* Right toolbar */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Trigger — summary chip (sm+) / icon-only (mobile). */}
        <button
          type="button"
          onClick={() => setTriggerOpen(true)}
          title="Edit trigger"
          className="hidden h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary sm:inline-flex"
        >
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="max-w-40 truncate">{triggerSummary(state)}</span>
        </button>
        <button
          type="button"
          onClick={() => setTriggerOpen(true)}
          aria-label="Edit trigger"
          title="Edit trigger"
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:hidden"
        >
          <Zap className="h-4.5 w-4.5" />
        </button>

        {state.status === 'active' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void setStatus('draft')}
            disabled={activating}
            className="h-9 px-3"
          >
            {activating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PauseCircle className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Pause</span>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void setStatus('active')}
            disabled={activating || !canActivate}
            title={
              !canActivate ? 'Fix the validation issues before activating' : undefined
            }
            className="h-9 px-3"
          >
            {activating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Activate</span>
          </Button>
        )}
        <Button
          onClick={() => void save()}
          disabled={saving}
          size="sm"
          className="h-9 px-4"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </Button>

        {/* Overflow: secondary actions */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More actions"
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none data-popup-open:bg-muted data-popup-open:text-foreground"
          >
            <MoreVertical className="h-4.5 w-4.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={() => router.push(`/flows/${flow.id}/runs`)}
            >
              <History className="size-4" />
              View runs
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => void deleteFlow()}>
              <Trash2 className="size-4" />
              Delete flow
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Trigger config modal */}
      <Dialog open={triggerOpen} onOpenChange={setTriggerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trigger</DialogTitle>
            <DialogDescription>
              Decide when this flow starts for a contact.
            </DialogDescription>
          </DialogHeader>
          <TriggerConfigForm />
        </DialogContent>
      </Dialog>

    </div>
  );
}

function StatusBadge({ status }: { status: BuilderState['status'] }) {
  const cls = {
    draft: 'border-border bg-muted text-muted-foreground',
    active:
      'border-emerald-600/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    archived: 'border-border bg-muted/50 text-muted-foreground',
  }[status];
  return (
    <Badge variant="outline" className={cn('shrink-0', cls)}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
