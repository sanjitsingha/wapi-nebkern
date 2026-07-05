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

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  History,
  Loader2,
  MoreVertical,
  PauseCircle,
  PlayCircle,
  Save,
  Trash2,
  Workflow,
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
import { IssueLine } from './validation-panel';
import { TriggerConfigForm, triggerSummary } from './trigger-config';

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
    issues,
    requestFlash,
  } = useFlowEditor();

  const [issuesOpen, setIssuesOpen] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.length - errorCount;

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

      <div className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary sm:flex">
        <Workflow className="h-4.5 w-4.5" />
      </div>

      {/* Name + description stack */}
      <div className="ml-0.5 flex min-w-0 flex-1 flex-col justify-center">
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

        {/* Validation — icon + count; opens the issues modal. */}
        <button
          type="button"
          onClick={() => setIssuesOpen(true)}
          title={
            issues.length === 0
              ? 'No issues'
              : `${errorCount} error${errorCount === 1 ? '' : 's'}, ${warningCount} warning${warningCount === 1 ? '' : 's'}`
          }
          aria-label="Validation issues"
          className={cn(
            'relative flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-muted',
            errorCount > 0
              ? 'text-red-500'
              : warningCount > 0
                ? 'text-amber-500'
                : 'text-emerald-500',
          )}
        >
          {issues.length === 0 ? (
            <CircleCheck className="h-4.5 w-4.5" />
          ) : (
            <CircleAlert className="h-4.5 w-4.5" />
          )}
          {issues.length > 0 && (
            <span
              className={cn(
                'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white',
                errorCount > 0 ? 'bg-red-500' : 'bg-amber-500',
              )}
            >
              {issues.length > 99 ? '99+' : issues.length}
            </span>
          )}
        </button>

        <span aria-hidden className="mx-0.5 h-6 w-px bg-border" />

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
              !canActivate ? 'Fix the issues below before activating' : undefined
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

      {/* Validation issues modal */}
      <Dialog open={issuesOpen} onOpenChange={setIssuesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Validation</DialogTitle>
            <DialogDescription>
              {issues.length === 0
                ? 'No issues — this flow is ready to activate.'
                : `${errorCount} error${errorCount === 1 ? '' : 's'} · ${warningCount} warning${warningCount === 1 ? '' : 's'}. Fix errors before activating.`}
            </DialogDescription>
          </DialogHeader>

          {issues.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-600 dark:text-emerald-300">
              <CircleCheck className="h-4 w-4 shrink-0" />
              Ready to activate.
            </div>
          ) : (
            <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {issues.map((issue, ix) => (
                <IssueLine
                  key={ix}
                  issue={issue}
                  onJump={(key) => {
                    requestFlash(key);
                    setIssuesOpen(false);
                  }}
                />
              ))}
            </div>
          )}
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
