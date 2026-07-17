'use client';

import { useState } from 'react';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';

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

interface DeleteCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The campaign name the user must retype exactly to confirm. */
  campaignName: string;
  /** Human label for the campaign's state, e.g. "scheduled" — used in copy. */
  statusLabel?: string;
  /** Runs the actual delete. Should redirect/close on success. */
  onConfirm: () => void | Promise<void>;
  /** True while the parent's delete is in flight. */
  deleting?: boolean;
}

/**
 * Type-to-confirm delete modal. The confirm button stays disabled until the
 * typed value matches the campaign name exactly (trimmed), so a scheduled or
 * in-flight campaign can't be dropped by a stray click. Mirrors the
 * "type the name to delete" pattern used for other destructive actions.
 */
export function DeleteCampaignDialog({
  open,
  onOpenChange,
  campaignName,
  statusLabel,
  onConfirm,
  deleting = false,
}: DeleteCampaignDialogProps) {
  const [value, setValue] = useState('');

  // Clear the field each time the dialog opens (adjust-state-on-open —
  // avoids a setState-in-effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValue('');
  }

  const matches = value.trim() === campaignName.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <DialogTitle className="text-popover-foreground">
            Delete campaign
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            This permanently deletes{' '}
            <span className="font-medium text-popover-foreground">
              {campaignName}
            </span>
            {statusLabel ? ` (${statusLabel})` : ''} and all of its recipient
            records. This can’t be undone.
            {statusLabel?.toLowerCase() === 'scheduled'
              ? ' The scheduled send will be cancelled.'
              : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-name" className="text-foreground">
            Type{' '}
            <span className="font-semibold text-popover-foreground">
              {campaignName}
            </span>{' '}
            to confirm
          </Label>
          <Input
            id="confirm-name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={campaignName}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={deleting}
            className="border-border bg-muted text-foreground"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches && !deleting) onConfirm();
            }}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
            className="border-border text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm()}
            disabled={!matches || deleting}
            className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="size-4" />
                Delete campaign
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
