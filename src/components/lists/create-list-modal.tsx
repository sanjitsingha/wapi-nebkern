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
import { ListPropertiesForm } from '@/components/lists/list-properties-form';
import { ContactPicker } from '@/components/lists/contact-picker';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/lib/supabase/client';
import type { List } from '@/types';

interface CreateListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (list: List) => void;
}

export function CreateListModal({
  open,
  onOpenChange,
  onCreated,
}: CreateListModalProps) {
  const supabase = createClient();
  const { accountId } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Every open starts a fresh list — carrying over the previous
  // name/selection would silently attach old contacts to a "new" list.
  useEffect(() => {
    if (open) return;
    setName('');
    setDescription('');
    setColor('');
    setSelectedIds([]);
  }, [open]);

  async function handleCreate() {
    if (!name.trim() || !accountId) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('create_list_with_contacts', {
        p_account_id: accountId,
        p_name: name.trim(),
        p_description: description.trim() || null,
        p_color: color || null,
        p_contact_ids: selectedIds,
      });

      if (error) throw error;

      toast.success('List created');
      onCreated(data as List);
      onOpenChange(false);
    } catch (err) {
      console.error('Create list error:', err);
      toast.error('Failed to create list');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(85vh,680px)] flex-col gap-0 overflow-hidden border-border bg-popover p-0 text-popover-foreground sm:max-w-2xl">
        <DialogHeader className="shrink-0 gap-3 border-b border-border px-6 py-5 pr-12">
          <div className="space-y-1">
            <DialogTitle className="text-popover-foreground">
              Create list
            </DialogTitle>
            <DialogDescription>
              Select contacts and save them as a reusable list.
            </DialogDescription>
          </div>
          <ListPropertiesForm
            name={name}
            onNameChange={setName}
            description={description}
            onDescriptionChange={setDescription}
            color={color}
            onColorChange={setColor}
            disabled={saving}
          />
        </DialogHeader>

        <ContactPicker
          open={open}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
        />

        <DialogFooter className="shrink-0 items-center border-t border-border bg-popover px-6 py-4 sm:justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {selectedIds.length}
            </span>{' '}
            {selectedIds.length === 1 ? 'contact' : 'contacts'} selected
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
              onClick={handleCreate}
              disabled={saving || !name.trim()}
            >
              {saving ? 'Creating...' : 'Create list'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
