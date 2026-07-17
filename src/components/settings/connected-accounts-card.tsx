'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Unlink } from 'lucide-react';
import type { UserIdentity } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';
import { GoogleIcon } from '@/components/auth/google-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

/**
 * Connected accounts — lets an email/password user link their Google
 * account so they can sign in with either from then on.
 *
 * Linking rides the same PKCE flow as "Continue with Google" on /login:
 * `linkIdentity` sends the browser to Google with `redirectTo` pointing at
 * /auth/callback, which exchanges the code and forwards back here with
 * `?linked=google` so we can confirm with a toast. Requires "Allow manual
 * linking" to be enabled in the Supabase dashboard — if it isn't, the
 * error from `linkIdentity` is surfaced as-is.
 *
 * Unlink is only offered while another sign-in method remains (Supabase
 * enforces this server-side too), so the user can't lock themselves out.
 */
export function ConnectedAccountsCard() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  // null = still loading the identity list.
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null);
  const [linking, setLinking] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const loadIdentities = useCallback(async () => {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) {
      console.error('[ConnectedAccounts] getUserIdentities error:', error.message);
      setIdentities([]);
      return;
    }
    setIdentities(data?.identities ?? []);
  }, [supabase]);

  useEffect(() => {
    loadIdentities();
  }, [loadIdentities]);

  // Landing back from a successful Google link (/auth/callback forwards to
  // ?tab=security&linked=google) — confirm once, then drop the marker from
  // the URL so a refresh doesn't re-toast.
  const toastedRef = useRef(false);
  useEffect(() => {
    if (searchParams.get('linked') === 'google' && !toastedRef.current) {
      toastedRef.current = true;
      toast.success('Google account linked — you can now sign in with Google');
      router.replace('/settings/profile?tab=security', { scroll: false });
    }
  }, [searchParams, router]);

  const googleIdentity = identities?.find((i) => i.provider === 'google');
  // Email address Google reported for the linked identity, for display.
  const googleEmail =
    (googleIdentity?.identity_data?.email as string | undefined) ?? null;
  // Only allow unlink while another way to sign in remains.
  const canUnlink = !!googleIdentity && (identities?.length ?? 0) > 1;

  const onLink = async () => {
    setLinking(true);
    const next = '/settings/profile?tab=security&linked=google';
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // On success the browser is already navigating to Google; we only
    // reach here if the request itself failed to start.
    if (error) {
      toast.error(`Could not start Google linking: ${error.message}`);
      setLinking(false);
    }
  };

  const onUnlink = async () => {
    if (!googleIdentity) return;
    setUnlinking(true);
    try {
      const { error } = await supabase.auth.unlinkIdentity(googleIdentity);
      if (error) {
        toast.error(`Could not unlink Google: ${error.message}`);
        return;
      }
      toast.success('Google account unlinked');
      setUnlinkOpen(false);
      await loadIdentities();
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <>
      <Card className="py-0">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
              <GoogleIcon />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Google</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {identities === null
                  ? 'Checking connection…'
                  : googleIdentity
                    ? `Connected${googleEmail ? ` as ${googleEmail}` : ''}`
                    : 'Link your Google account to sign in with one click'}
              </p>
            </div>
          </div>

          {identities !== null &&
            (googleIdentity ? (
              canUnlink && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setUnlinkOpen(true)}
                  className="shrink-0"
                >
                  <Unlink className="size-4" />
                  Unlink
                </Button>
              )
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={onLink}
                disabled={linking}
                className="shrink-0"
              >
                {linking ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Redirecting…
                  </>
                ) : (
                  'Link Google account'
                )}
              </Button>
            ))}
        </CardContent>
      </Card>

      <Dialog open={unlinkOpen} onOpenChange={setUnlinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlink Google account?</DialogTitle>
            <DialogDescription>
              You will no longer be able to sign in with Google
              {googleEmail ? ` (${googleEmail})` : ''}. You can still sign in
              with your email and password, and re-link Google at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setUnlinkOpen(false)}
              disabled={unlinking}
            >
              Cancel
            </Button>
            <Button type="button" onClick={onUnlink} disabled={unlinking}>
              {unlinking ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Unlinking…
                </>
              ) : (
                'Unlink Google'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
