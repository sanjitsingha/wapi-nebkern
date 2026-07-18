'use client';

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Bot, Calendar, Check, Sparkles, User, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Profile } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreatedAtFilterDialog } from '@/components/contacts/created-at-filter-dialog';

export type AssigneeFilter = 'ai' | 'bot' | 'user';

const ASSIGNEE_OPTIONS: {
  label: string;
  description: string;
  value: AssigneeFilter;
  icon: LucideIcon;
}[] = [
  { label: 'AI Agent', description: 'Handled by the AI agent', value: 'ai', icon: Sparkles },
  { label: 'Bot', description: 'Running an automated flow', value: 'bot', icon: Bot },
  { label: 'Team member', description: 'Assigned to a teammate', value: 'user', icon: User },
];

function formatDateLabel(value: string): string {
  return format(parseISO(value), 'MMM d, yyyy');
}

interface InboxFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appliedAssignees: AssigneeFilter[];
  appliedAssignedUserId: string | null;
  appliedCreatedFrom: string;
  appliedCreatedTo: string;
  profiles: Profile[];
  onApply: (filters: {
    assignees: AssigneeFilter[];
    assignedUserId: string | null;
    createdFrom: string;
    createdTo: string;
  }) => void;
}

/**
 * Secondary inbox filters — who's handling the conversation (any
 * combination of AI Agent / Bot / a teammate) and when it started. Pulled
 * out of the chip row into a modal (staged local state, single Apply)
 * because the row was getting crowded with 5+ controls; "All" (status) and
 * "Tag" stay inline since those are the two most-used filters.
 *
 * Assignee is multi-select: pick any mix of handlers and the list shows
 * conversations matching ANY of them. No selection means "anyone".
 */
export function InboxFiltersDialog({
  open,
  onOpenChange,
  appliedAssignees,
  appliedAssignedUserId,
  appliedCreatedFrom,
  appliedCreatedTo,
  profiles,
  onApply,
}: InboxFiltersDialogProps) {
  const [assignees, setAssignees] = useState<AssigneeFilter[]>([]);
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [dateDialogOpen, setDateDialogOpen] = useState(false);

  // Re-seed from the applied filters every time the dialog opens, so
  // closing without Apply can't leak an in-progress edit.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAssignees(appliedAssignees);
    setAssignedUserId(appliedAssignedUserId);
    setCreatedFrom(appliedCreatedFrom);
    setCreatedTo(appliedCreatedTo);
  }, [open, appliedAssignees, appliedAssignedUserId, appliedCreatedFrom, appliedCreatedTo]);

  const hasDateRange = createdFrom !== '' || createdTo !== '';
  const hasAnyFilter = assignees.length > 0 || hasDateRange;

  function toggleAssignee(value: AssigneeFilter) {
    const next = assignees.includes(value)
      ? assignees.filter((v) => v !== value)
      : [...assignees, value];
    setAssignees(next);
    // Drop the specific-teammate narrow when "Team member" is turned off.
    if (value === 'user' && !next.includes('user')) setAssignedUserId(null);
  }

  function handleApply() {
    onApply({ assignees, assignedUserId, createdFrom, createdTo });
    onOpenChange(false);
  }

  function handleClear() {
    setAssignees([]);
    setAssignedUserId(null);
    setCreatedFrom('');
    setCreatedTo('');
  }

  const dateRangeLabel = hasDateRange
    ? `${createdFrom ? formatDateLabel(createdFrom) : 'Any'} – ${createdTo ? formatDateLabel(createdTo) : 'Any'}`
    : 'Any dates';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="border-border bg-popover text-popover-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">Filters</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Narrow the conversation list. Pick any combination of handlers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Assigned to — multi-select */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Assigned to
                </p>
                {assignees.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAssignees([]);
                      setAssignedUserId(null);
                    }}
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                {ASSIGNEE_OPTIONS.map((opt) => {
                  const selected = assignees.includes(opt.value);
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleAssignee(opt.value)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                        selected
                          ? 'border-primary/40 bg-primary-soft'
                          : 'border-border hover:bg-muted',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-full',
                          selected
                            ? 'bg-primary/15 text-primary'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block text-sm font-medium',
                            selected ? 'text-primary' : 'text-popover-foreground',
                          )}
                        >
                          {opt.label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {opt.description}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border',
                        )}
                      >
                        {selected && <Check className="size-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Team member sub-picker, only when "Team member" is selected. */}
              {assignees.includes('user') && (
                <div className="mt-1 ml-2 max-h-40 space-y-0.5 overflow-y-auto border-l border-border pl-3">
                  <button
                    type="button"
                    onClick={() => setAssignedUserId(null)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                      !assignedUserId
                        ? 'text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <span className="flex-1 truncate">Any teammate</span>
                    {!assignedUserId && <Check className="size-3.5 shrink-0" />}
                  </button>
                  {profiles.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">No teammates</p>
                  ) : (
                    profiles.map((p) => {
                      const selected = assignedUserId === p.user_id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setAssignedUserId(p.user_id)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                            selected
                              ? 'text-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          <span className="flex-1 truncate">{p.full_name}</span>
                          {selected && <Check className="size-3.5 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Date range */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Started
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDateDialogOpen(true)}
                className={cn(
                  'h-10 w-full justify-start gap-2 border-border font-normal',
                  hasDateRange ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                <Calendar className="size-4 shrink-0" />
                {dateRangeLabel}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={!hasAnyFilter}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Clear
            </Button>
            <Button onClick={handleApply}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreatedAtFilterDialog
        open={dateDialogOpen}
        onOpenChange={setDateDialogOpen}
        appliedFrom={createdFrom}
        appliedTo={createdTo}
        onApply={(from, to) => {
          setCreatedFrom(from);
          setCreatedTo(to);
        }}
        title="Filter by conversation date"
        description="Show conversations started within a date range."
      />
    </>
  );
}
