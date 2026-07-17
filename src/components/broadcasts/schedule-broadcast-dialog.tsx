'use client';

import { useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Loader2,
  Users,
  FileText,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ScheduleBroadcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignName: string;
  templateName: string;
  estimatedReach: number;
  /** Blocks the confirm button while the parent has a send/schedule in flight. */
  disabled?: boolean;
  /**
   * Persist the scheduled broadcast. Must resolve on success and throw on
   * failure — the dialog switches to its success screen only after this
   * resolves.
   */
  onSchedule: (scheduledAtIso: string) => Promise<void>;
  /** Primary action on the success screen (e.g. navigate to campaigns). */
  onDone?: () => void;
}

/** Local `Date` → the `YYYY-MM-DDTHH:mm` string a datetime-local input wants. */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

type Phase = 'form' | 'submitting' | 'success';

export function ScheduleBroadcastDialog({
  open,
  onOpenChange,
  campaignName,
  templateName,
  estimatedReach,
  disabled,
  onSchedule,
  onDone,
}: ScheduleBroadcastDialogProps) {
  // Default the picker an hour out; floor the min at "now" so a past time
  // can't be chosen (the cron only fires forward).
  const now = new Date();
  const defaultValue = toLocalInputValue(new Date(now.getTime() + 60 * 60 * 1000));
  const minValue = toLocalInputValue(now);

  const [value, setValue] = useState(defaultValue);
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState<string | null>(null);
  const [scheduledIso, setScheduledIso] = useState<string | null>(null);

  // Reset to a clean form each time the dialog opens (adjust-state-on-open
  // pattern — avoids a setState-in-effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPhase('form');
      setError(null);
      setValue(defaultValue);
      setScheduledIso(null);
    }
  }

  const submit = async () => {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      setError('Choose a date and time.');
      return;
    }
    if (parsed.getTime() <= Date.now()) {
      setError('Pick a time in the future.');
      return;
    }

    const iso = parsed.toISOString();
    setError(null);
    setPhase('submitting');
    try {
      await onSchedule(iso);
      setScheduledIso(iso);
      setPhase('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule.');
      setPhase('form');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover sm:max-w-md">
        {phase === 'success' ? (
          <>
            <DialogHeader>
              <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="size-6 text-primary" />
              </div>
              <DialogTitle className="text-popover-foreground">
                Campaign scheduled
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {campaignName
                  ? `“${campaignName}” will send automatically at the time below.`
                  : 'Your campaign will send automatically at the time below.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4 text-sm">
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-primary" />
                <span className="font-medium text-popover-foreground">
                  {scheduledIso
                    ? new Date(scheduledIso).toLocaleString(undefined, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="size-4" />
                <span>{templateName}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="size-4" />
                <span>{estimatedReach.toLocaleString()} recipients</span>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                onClick={() => (onDone ? onDone() : onOpenChange(false))}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                View campaigns
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-popover-foreground">
                Schedule campaign
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Pick when this campaign should send to{' '}
                <span className="font-medium text-popover-foreground">
                  {estimatedReach.toLocaleString()}
                </span>{' '}
                contacts using the{' '}
                <span className="font-medium text-popover-foreground">
                  {templateName}
                </span>{' '}
                template.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="schedule-at" className="text-foreground">
                Send at
              </Label>
              <Input
                id="schedule-at"
                type="datetime-local"
                value={value}
                min={minValue}
                onChange={(e) => setValue(e.target.value)}
                disabled={phase === 'submitting'}
                className="border-border bg-muted text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Uses your device’s time zone. The campaign sends automatically —
                you don’t need to keep this page open.
              </p>
              {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={phase === 'submitting'}
                className="border-border text-muted-foreground"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={submit}
                disabled={disabled || phase === 'submitting'}
                className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {phase === 'submitting' ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Scheduling…
                  </>
                ) : (
                  <>
                    <CalendarClock className="size-4" />
                    Schedule
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
