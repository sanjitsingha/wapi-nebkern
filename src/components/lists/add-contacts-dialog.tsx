'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ContactPicker } from '@/components/lists/contact-picker';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/lib/supabase/client';

interface AddContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  /** Contacts already in the list — hidden from the picker so they
   *  can't be selected again. */
  existingContactIds: Set<string>;
  onAdded: () => void;
}

export function AddContactsDialog({
  open,
  onOpenChange,
  listId,
  existingContactIds,
  onAdded,
}: AddContactsDialogProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) return;
    setSelectedIds([]);
  }, [open]);

  async function handleAdd() {
    if (selectedIds.length === 0) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('contact_lists').upsert(
        selectedIds.map((contactId) => ({
          contact_id: contactId,
          list_id: listId,
          added_by: user?.id,
        })),
        { onConflict: 'contact_id,list_id', ignoreDuplicates: true }
      );

      if (error) throw error;

      toast.success(
        `${selectedIds.length} contact${selectedIds.length === 1 ? '' : 's'} added`
      );
      onAdded();
      onOpenChange(false);
    } catch (err) {
      console.error('Add contacts error:', err);
      toast.error('Failed to add contacts');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(85vh,680px)] flex-col gap-0 overflow-hidden border-border bg-popover p-0 text-popover-foreground sm:max-w-2xl">
        <DialogHeader className="shrink-0 gap-1 border-b border-border px-6 py-5 pr-12">
          <DialogTitle className="text-popover-foreground">
            Add contacts
          </DialogTitle>
          <DialogDescription>
            Contacts already in this list are hidden below.
          </DialogDescription>
        </DialogHeader>

        <ContactPicker
          open={open}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          excludeContactIds={existingContactIds}
        />

        <DialogFooter className="shrink-0 items-center border-t border-border bg-popover px-6 py-4 sm:justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {selectedIds.length}
            </span>{' '}
            selected
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={saving || selectedIds.length === 0}
            >
              {saving ? 'Adding...' : 'Add contacts'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
