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
import { createClient } from '@/lib/supabase/client';
import type { List } from '@/types';

interface EditListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: List | null;
  onSaved: (list: List) => void;
}

export function EditListDialog({
  open,
  onOpenChange,
  list,
  onSaved,
}: EditListDialogProps) {
  const supabase = createClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');
  const [saving, setSaving] = useState(false);

  // Re-seed from the target list every time the dialog opens so a
  // previous edit's in-progress fields never leak into the next one.
  useEffect(() => {
    if (!open || !list) return;
    setName(list.name);
    setDescription(list.description ?? '');
    setColor(list.color ?? '');
  }, [open, list]);

  async function handleSave() {
    if (!list || !name.trim()) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('lists')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          color: color || null,
        })
        .eq('id', list.id)
        .select('*')
        .single();

      if (error) throw error;

      toast.success('List updated');
      onSaved(data as List);
      onOpenChange(false);
    } catch (err) {
      console.error('Update list error:', err);
      toast.error('Failed to update list');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover text-popover-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            Edit list
          </DialogTitle>
          <DialogDescription>
            Update the name, description, or colour.
          </DialogDescription>
        </DialogHeader>

        <ListPropertiesForm
          name={name}
          onNameChange={setName}
          description={description}
          onDescriptionChange={setDescription}
          color={color}
          onColorChange={setColor}
          disabled={saving}
        />

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
