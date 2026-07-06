'use client';

import { useState } from 'react';
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
import { createClient } from '@/lib/supabase/client';
import type { List } from '@/types';

interface DeleteListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: List | null;
  onDeleted: (listId: string) => void;
}

export function DeleteListDialog({
  open,
  onOpenChange,
  list,
  onDeleted,
}: DeleteListDialogProps) {
  const supabase = createClient();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!list) return;

    setDeleting(true);
    try {
      const { error } = await supabase.from('lists').delete().eq('id', list.id);
      if (error) throw error;

      toast.success('List deleted');
      onDeleted(list.id);
      onOpenChange(false);
    } catch (err) {
      console.error('Delete list error:', err);
      toast.error('Failed to delete list');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover text-popover-foreground sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            Delete list
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Delete &quot;{list?.name}&quot;? Its {list?.total_contacts ?? 0}{' '}
            contact{list?.total_contacts === 1 ? '' : 's'} will not be
            deleted — only the list itself. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete list'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
