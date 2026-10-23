'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Switch } from '@/components/ui/switch';

/**
 * Maya's on/off switch — the master switch (`is_active`). Off, she
 * replies to no one, assigned chats included; on, she answers per the
 * auto-reply setting, which this card reports but leaves alone.
 */
export function MayaPowerCard({
  configured,
  isActive,
  autoReplyEnabled,
  canEdit,
  onChanged,
}: {
  configured: boolean;
  isActive: boolean;
  autoReplyEnabled: boolean;
  canEdit: boolean;
  /** Reload the page's summary after a change. */
  onChanged: () => Promise<unknown> | void;
}) {
  const [saving, setSaving] = useState(false);
  // Shown while the request is in flight, so the switch moves at once;
  // cleared after, falling back to the reloaded value — or to the old
  // one if the change failed.
  const [pending, setPending] = useState<boolean | null>(null);
  const on = pending ?? isActive;

  async function toggle(next: boolean) {
    setSaving(true);
    setPending(next);
    try {
      const res = await fetch('/api/ai/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || `Could not switch Maya ${next ? 'on' : 'off'}.`);
        return;
      }
      toast.success(next ? 'Maya is on.' : 'Maya is off.');
      await onChanged();
    } catch {
      toast.error('Could not reach Dripo. Check your connection and try again.');
    } finally {
      setPending(null);
      setSaving(false);
    }
  }

  const description = !configured
    ? null
    : !on
      ? 'Maya is off and won’t reply to anyone. You can still test her in the Playground.'
      : autoReplyEnabled
        ? 'Maya is on and answering new messages automatically.'
        : 'Maya is on. Automatic replies are off, so she answers only in chats assigned to her.';

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
      <Switch
        checked={configured && on}
        onCheckedChange={(next) => void toggle(next)}
        disabled={!configured || !canEdit || saving}
        aria-label="Turn Maya on or off"
        title={!canEdit ? 'Only admins can switch Maya on or off.' : undefined}
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">AI Agent</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {description ??
            'Maya isn’t available yet — AI is still being set up for Dripo. Please check back soon.'}
        </p>
      </div>
    </div>
  );
}
