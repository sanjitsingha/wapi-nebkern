'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';

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
import { useAuth } from '@/hooks/use-auth';
import { DELETION_WINDOW_DAYS } from '@/lib/account/deletion-window';

/**
 * Delete the whole organisation account.
 *
 * Owner-only, and hidden entirely from everyone else rather than shown
 * disabled: this is not a permission someone should be invited to ask
 * for, and an admin seeing a greyed-out "delete the company" button is
 * an invitation to try. The API enforces the same rule regardless.
 *
 * Confirmation is type-the-account-name. A checkbox or a second "are
 * you sure" is muscle memory by the second time someone sees it —
 * typing the name is the cheapest control that requires actually
 * reading which account is about to go.
 */
export function DeleteAccountCard() {
  const { account, isOwner } = useAuth();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);

  if (!isOwner) return null;

  const accountName = account?.name ?? '';
  const confirmed = typed.trim() === accountName.trim() && accountName !== '';

  async function handleDelete() {
    setWorking(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? 'Could not schedule the deletion.');
      }
      // Straight to the lockout screen. Staying on a settings page that
      // every subsequent request will now 403 would just produce a
      // cascade of failed loads.
      router.push('/account-deleted');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not schedule the deletion.'
      );
      setWorking(false);
    }
  }

  return (
    <div className="border-destructive/30 bg-card rounded-xl border p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-destructive mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-foreground text-sm font-semibold">
            Delete this account
          </h3>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Closes {accountName || 'the account'} for everyone in it. Access
            stops immediately and the data is kept for {DELETION_WINDOW_DAYS}{' '}
            days, during which the account can be restored from a link emailed
            to you. After that it is permanently deleted.
          </p>

          <Button
            variant="destructive"
            onClick={() => setOpen(true)}
            className="mt-4 h-11"
          >
            Delete account
          </Button>
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (working) return;
          setOpen(next);
          if (!next) {
            setTyped('');
            setReason('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {accountName}?</DialogTitle>
            <DialogDescription>
              Everyone in this account is signed out and locked out immediately.
              Conversations, contacts, campaigns and billing history are kept
              for {DELETION_WINDOW_DAYS} days, then deleted for good. We will
              email you a link that restores everything if you change your mind
              inside that window.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="confirm-name">
                Type{' '}
                <span className="text-foreground font-semibold">
                  {accountName}
                </span>{' '}
                to confirm
              </Label>
              <Input
                id="confirm-name"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                placeholder={accountName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-reason">
                Anything we could have done better?{' '}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="delete-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="h-11"
              disabled={working}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="h-11"
              disabled={!confirmed || working}
              onClick={handleDelete}
            >
              {working && <Loader2 className="size-4 animate-spin" />}
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
