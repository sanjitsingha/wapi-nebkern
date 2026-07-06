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
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { createClient } from '@/lib/supabase/client';
import type { List } from '@/types';

interface DuplicateListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: List | null;
  onDuplicated: (list: List) => void;
}

export function DuplicateListDialog({
  open,
  onOpenChange,
  list,
  onDuplicated,
}: DuplicateListDialogProps) {
  const supabase = createClient();
  const [name, setName] = useState('');
  const [copyContacts, setCopyContacts] = useState<'with' | 'empty'>('with');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !list) return;
    setName(`${list.name} (copy)`);
    setCopyContacts('with');
  }, [open, list]);

  async function handleDuplicate() {
    if (!list || !name.trim()) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('duplicate_list', {
        p_source_list_id: list.id,
        p_new_name: name.trim(),
        p_copy_contacts: copyContacts === 'with',
      });

      if (error) throw error;

      toast.success('List duplicated');
      onDuplicated(data as List);
      onOpenChange(false);
    } catch (err) {
      console.error('Duplicate list error:', err);
      toast.error('Failed to duplicate list');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover text-popover-foreground sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            Duplicate list
          </DialogTitle>
          <DialogDescription>
            Create a copy of &quot;{list?.name}&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="List name"
            className="h-11"
            disabled={saving}
            autoFocus
            maxLength={80}
          />

          <RadioGroup
            value={copyContacts}
            onValueChange={(value) =>
              setCopyContacts(value as 'with' | 'empty')
            }
          >
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
              <RadioGroupItem value="with" id="dup-with-contacts" />
              Copy {list?.total_contacts ?? 0} contact
              {list?.total_contacts === 1 ? '' : 's'}
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
              <RadioGroupItem value="empty" id="dup-empty" />
              Start as an empty list
            </label>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleDuplicate} disabled={saving || !name.trim()}>
            {saving ? 'Duplicating...' : 'Duplicate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
