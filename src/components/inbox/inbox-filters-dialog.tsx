'use client';

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Bot, Check, Sparkles, User, Users } from 'lucide-react';

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

export type AssigneeFilter = 'ai' | 'bot' | 'user' | null;

const ASSIGNEE_OPTIONS: {
  label: string;
  value: AssigneeFilter;
  icon: typeof Users;
}[] = [
  { label: 'Anyone', value: null, icon: Users },
  { label: 'AI Agent', value: 'ai', icon: Sparkles },
  { label: 'Bot', value: 'bot', icon: Bot },
  { label: 'Team member', value: 'user', icon: User },
];

function formatDateLabel(value: string): string {
  return format(parseISO(value), 'MMM d, yyyy');
}

interface InboxFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appliedAssignee: AssigneeFilter;
  appliedAssignedUserId: string | null;
  appliedCreatedFrom: string;
  appliedCreatedTo: string;
  profiles: Profile[];
  onApply: (filters: {
    assignee: AssigneeFilter;
    assignedUserId: string | null;
    createdFrom: string;
    createdTo: string;
  }) => void;
}

/**
 * Secondary inbox filters — who's handling the conversation (AI Agent /
 * Bot / a specific teammate) and when it started. Pulled out of the
 * chip row into a modal (staged local state, single Apply) because the
 * row was getting crowded with 5+ controls; "All" (status) and "Tag"
 * stay inline since those are the two most-used filters.
 */
export function InboxFiltersDialog({
  open,
  onOpenChange,
  appliedAssignee,
  appliedAssignedUserId,
  appliedCreatedFrom,
  appliedCreatedTo,
  profiles,
  onApply,
}: InboxFiltersDialogProps) {
  const [assignee, setAssignee] = useState<AssigneeFilter>(null);
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [dateDialogOpen, setDateDialogOpen] = useState(false);

  // Re-seed from the applied filters every time the dialog opens, so
  // closing without Apply can't leak an in-progress edit.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAssignee(appliedAssignee);
    setAssignedUserId(appliedAssignedUserId);
    setCreatedFrom(appliedCreatedFrom);
    setCreatedTo(appliedCreatedTo);
  }, [open, appliedAssignee, appliedAssignedUserId, appliedCreatedFrom, appliedCreatedTo]);

  const hasDateRange = createdFrom !== '' || createdTo !== '';
  const hasAnyFilter = assignee !== null || hasDateRange;

  function handleApply() {
    onApply({ assignee, assignedUserId, createdFrom, createdTo });
    onOpenChange(false);
  }

  function handleClear() {
    setAssignee(null);
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
        <DialogContent className="border-border bg-popover text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">
              Filters
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Narrow the conversation list by who&apos;s handling it and when
              it started.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Assigned to */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Assigned to
              </p>
              <div className="space-y-1">
                {ASSIGNEE_OPTIONS.map((opt) => {
                  const selected = assignee === opt.value;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        setAssignee(opt.value);
                        if (opt.value !== 'user') setAssignedUserId(null);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                        selected
                          ? 'bg-primary-soft text-primary'
                          : 'text-popover-foreground hover:bg-muted',
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1">{opt.label}</span>
                      {selected && <Check className="size-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Team member sub-picker, only when "Team member" is chosen. */}
              {assignee === 'user' && (
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
                    <span className="flex-1 truncate">Anyone</span>
                    {!assignedUserId && <Check className="size-3.5 shrink-0" />}
                  </button>
                  {profiles.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                      No teammates
                    </p>
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
                  'h-10 w-full justify-start border-border font-normal',
                  hasDateRange ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
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
