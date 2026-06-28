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
  PauseCircle,
  PlayCircle,
  Save,
  Trash2,
  Workflow,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useFlowEditor, type BuilderState } from './flow-editor-state';

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
    <div className="border-border flex flex-col gap-3 border-b pb-4">
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => router.push('/flows')}
          className="hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" />
          Flows
        </button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Workflow className="text-primary h-5 w-5 shrink-0" />
          <Input
            value={state.name}
            onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
            placeholder="Flow name"
            className="bg-card max-w-md min-w-0 flex-1 text-lg font-semibold"
          />
          <StatusBadge status={state.status} />
          {dirty && (
            <span
              className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium tracking-wide text-amber-300 uppercase"
              title="Unsaved changes — hit Save to persist"
              aria-live="polite"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Edited
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/flows/${flow.id}/runs`)}
          >
            <History className="h-3.5 w-3.5" />
            Runs
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void deleteFlow()}
            className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
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
              Pause
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void setStatus('active')}
              disabled={activating || !canActivate}
              title={
                !canActivate
                  ? 'Fix the issues below before activating'
                  : undefined
              }
            >
              {activating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlayCircle className="h-3.5 w-3.5" />
              )}
              Activate
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
        </div>
      </div>

      <Input
        value={state.description}
        onChange={(e) =>
          setState((s) => ({ ...s, description: e.target.value }))
        }
        placeholder="Optional description (internal — customers don't see this)"
        className="bg-card text-sm"
      />
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
