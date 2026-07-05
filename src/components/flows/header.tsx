'use client';

/**
 * Editor header — flow name / description, status badge, dirty
 * indicator, and the action buttons (Save, Activate/Pause, Delete,
 * View runs, Back).
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
  Workflow,
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
import { cn } from '@/lib/utils';
import { useFlowEditor, type BuilderState } from './flow-editor-state';

// Single-row editor top bar: back · name/description · status · primary
// actions (Activate/Pause, Save) · overflow menu (Runs, Delete). The
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

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <button
        type="button"
        onClick={() => router.push('/flows')}
        aria-label="Back to flows"
        className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      <Workflow className="hidden size-5 shrink-0 text-primary sm:block" />

      {/* Name + description stack */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex min-w-0 items-center gap-2">
          <input
            value={state.name}
            onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
            placeholder="Flow name"
            className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:bg-muted focus:outline-none sm:text-base"
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
        <input
          value={state.description}
          onChange={(e) =>
            setState((s) => ({ ...s, description: e.target.value }))
          }
          placeholder="Add a description (internal)"
          className="min-w-0 truncate rounded-md bg-transparent px-1 text-xs text-muted-foreground placeholder:text-muted-foreground/70 focus:bg-muted focus:outline-none"
        />
      </div>

      {/* Primary actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        {state.status === 'active' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void setStatus('draft')}
            disabled={activating}
          >
            {activating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PauseCircle className="h-3.5 w-3.5" />
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
              !canActivate ? 'Fix the issues below before activating' : undefined
            }
          >
            {activating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlayCircle className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Activate</span>
          </Button>
        )}
        <Button onClick={() => void save()} disabled={saving} size="sm">
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save
        </Button>

        {/* Overflow: secondary actions */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More actions"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none data-popup-open:bg-muted data-popup-open:text-foreground"
          >
            <MoreVertical className="h-4 w-4" />
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
    </div>
  );
}

function StatusBadge({ status }: { status: BuilderState['status'] }) {
  const cls = {
    draft: 'border-border bg-muted text-muted-foreground',
    active: 'border-emerald-600/40 bg-emerald-500/10 text-emerald-300',
    archived: 'border-border bg-muted/50 text-muted-foreground',
  }[status];
  return (
    <Badge variant="outline" className={cn('shrink-0', cls)}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
