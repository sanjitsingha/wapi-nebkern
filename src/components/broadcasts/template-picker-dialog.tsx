'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';

import { MessageTemplate } from '@/types';
import { Step1ChooseTemplate } from '@/components/broadcasts/step1-choose-template';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface TemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired when the user confirms a choice with "Continue". */
  onConfirm: (template: MessageTemplate) => void;
  /** Pre-highlight this template when the dialog opens (e.g. the one already
   *  chosen on the campaign page), so re-browsing starts from the current
   *  selection instead of blank. */
  initialTemplate?: MessageTemplate | null;
  /** Continue button label — defaults to "Continue". */
  confirmLabel?: string;
}

/**
 * Modal for picking an approved template. Selection is held locally and only
 * committed on "Continue", so cancelling leaves the caller's state untouched.
 * Reuses {@link Step1ChooseTemplate} (embedded) for the fetch + card grid so
 * the template cards look identical to the inline builder.
 */
export function TemplatePickerDialog({
  open,
  onOpenChange,
  onConfirm,
  initialTemplate = null,
  confirmLabel = 'Continue',
}: TemplatePickerDialogProps) {
  const [selected, setSelected] = useState<MessageTemplate | null>(
    initialTemplate
  );

  // Reset the local selection each time the dialog transitions to open so it
  // reflects the caller's current choice (and a cancelled edit doesn't
  // linger). Adjusting state during render on an open→ change is React's
  // recommended alternative to a setState-in-effect here.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSelected(initialTemplate);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose a template</DialogTitle>
          <DialogDescription>
            Pick an approved template to start your campaign.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 max-h-[60vh] overflow-y-auto px-1">
          <Step1ChooseTemplate
            embedded
            selectedTemplate={selected}
            onSelect={setSelected}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selected}
            onClick={() => {
              if (selected) onConfirm(selected);
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {confirmLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
