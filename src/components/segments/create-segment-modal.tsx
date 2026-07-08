'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/lib/supabase/client';
import { createSegment } from '@/lib/segments/queries';
import { emptyRootGroup } from '@/lib/segments/rules';

interface CreateSegmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Collects name / description / colour, creates an empty-rule segment,
 * then routes to the builder (`/segments/[id]`) where the rules — the
 * whole point of a segment — are defined.
 */
export function CreateSegmentModal({ open, onOpenChange }: CreateSegmentModalProps) {
  const supabase = createClient();
  const router = useRouter();
  const { accountId } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) return;
    setName('');
    setDescription('');
    setColor('');
  }, [open]);

  async function handleCreate() {
    if (!name.trim() || !accountId) return;
    setSaving(true);
    try {
      const segment = await createSegment(supabase, {
        accountId,
        name: name.trim(),
        description: description.trim() || null,
        color: color || null,
        rules: emptyRootGroup(),
      });
      toast.success('Segment created — now add some rules');
      onOpenChange(false);
      router.push(`/segments/${segment.id}`);
    } catch (err) {
      console.error('Create segment error:', err);
      toast.error('Failed to create segment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover text-popover-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">Create segment</DialogTitle>
          <DialogDescription>
            Name your segment. You&apos;ll define its filter rules next.
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
          namePlaceholder="Segment name"
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? 'Creating…' : 'Create & add rules'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
