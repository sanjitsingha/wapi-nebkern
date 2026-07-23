'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, LogOut, Monitor, RefreshCw, Smartphone } from 'lucide-react';

import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
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

// One row from public.list_user_sessions() (migration 071).
interface UserSession {
  id: string;
  created_at: string | null;
  updated_at: string | null;
  refreshed_at: string | null;
  not_after: string | null;
  user_agent: string | null;
  ip: string | null;
}

/** Turn a raw User-Agent into a "Chrome on Windows" style label + whether
 *  it's a phone/tablet, for picking the icon. Best-effort, no library. */
function describeDevice(ua: string | null): { label: string; mobile: boolean } {
  if (!ua) return { label: 'Unknown device', mobile: false };
  const mobile = /Mobile|Android|iPhone|iPad|iPod|Tablet/i.test(ua);

  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';

  let os = '';
  if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Linux/.test(ua)) os = 'Linux';

  return { label: os ? `${browser} on ${os}` : browser, mobile };
}

/** Compact "last active" from an ISO instant. */
function lastActive(iso: string | null): string {
  if (!iso) return 'Unknown';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'Unknown';
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return 'Active now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? '' : 's'} ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
  return new Date(t).toLocaleDateString();
}

/** Pull the `session_id` claim out of the current access token so we can
 *  mark which row is THIS device. JWTs are base64url — pad before atob. */
function sessionIdFromToken(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    let b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    b64 = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
    const payload = JSON.parse(atob(b64));
    return typeof payload.session_id === 'string' ? payload.session_id : null;
  } catch {
    return null;
  }
}

export function SessionsCard() {
  const supabase = createClient();

  // null = still loading. [] = loaded, none (or couldn't read).
  const [sessions, setSessions] = useState<UserSession[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_user_sessions');
    if (error) {
      console.error('[SessionsCard] list_user_sessions error:', error.message);
      setLoadError(true);
      setSessions([]);
      return;
    }
    setLoadError(false);
    setSessions((data ?? []) as UserSession[]);
  }, [supabase]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) setCurrentId(sessionIdFromToken(data.session?.access_token));
      if (mounted) await load();
    })();
    return () => {
      mounted = false;
    };
  }, [supabase, load]);

  const revoke = async (id: string) => {
    setRevokingId(id);
    try {
      const { data, error } = await supabase.rpc('revoke_user_session', {
        target: id,
      });
      if (error) {
        toast.error(`Couldn't sign that device out: ${error.message}`);
        return;
      }
      if (data === false) {
        toast.error('That session is no longer active.');
      } else {
        toast.success('Device signed out');
      }
      // Optimistically drop it, then reconcile with a fresh read.
      setSessions((prev) => prev?.filter((s) => s.id !== id) ?? prev);
      await load();
    } finally {
      setRevokingId(null);
    }
  };

  const onSignOutEverywhere = async () => {
    setSigningOut(true);
    try {
      // scope: 'global' revokes every refresh token for this user across
      // all devices; the auth-state change on this tab redirects us.
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        toast.error(`Sign-out failed: ${error.message}`);
        return;
      }
      window.location.href = '/login';
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSigningOut(false);
    }
  };

  const otherCount = sessions
    ? sessions.filter((s) => s.id !== currentId).length
    : 0;

  return (
    <>
      <Card className="py-0">
        <CardContent className="px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Devices &amp; sessions
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Every device currently signed into your account. Sign out any
                you don&apos;t recognise.
              </p>
            </div>
            <button
              type="button"
              onClick={() => load()}
              className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1.5 text-xs font-medium transition-colors"
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </button>
          </div>

          <div className="mt-4">
            {sessions === null ? (
              <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Loading your devices…
              </div>
            ) : loadError ? (
              <p className="text-muted-foreground py-4 text-sm">
                Couldn&apos;t load your device list. You can still sign out of
                everywhere below.
              </p>
            ) : sessions.length === 0 ? (
              <p className="text-muted-foreground py-4 text-sm">
                No active sessions found.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {sessions.map((s) => {
                  const { label, mobile } = describeDevice(s.user_agent);
                  const isCurrent = s.id === currentId;
                  const Icon = mobile ? Smartphone : Monitor;
                  return (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-lg border',
                            isCurrent
                              ? 'border-primary/30 bg-primary-soft text-primary'
                              : 'border-border bg-background text-muted-foreground',
                          )}
                        >
                          <Icon className="size-4.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <span className="truncate">{label}</span>
                            {isCurrent && (
                              <span className="bg-primary-soft text-primary shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                                This device
                              </span>
                            )}
                          </p>
                          <p className="text-muted-foreground mt-0.5 truncate text-xs">
                            {s.ip ? `${s.ip} · ` : ''}
                            {lastActive(s.refreshed_at ?? s.updated_at ?? s.created_at)}
                          </p>
                        </div>
                      </div>

                      {isCurrent ? (
                        <span className="text-muted-foreground shrink-0 text-xs">
                          Current session
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => revoke(s.id)}
                          disabled={revokingId !== null}
                          className="shrink-0"
                        >
                          {revokingId === s.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <LogOut className="size-4" />
                          )}
                          Sign out
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Blanket sign-out — always available, even if the list failed. */}
          <div className="border-border mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-muted-foreground text-sm">
              {otherCount > 0
                ? `Signed in on ${otherCount + 1} devices.`
                : 'Sign out of this account on every device.'}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSignOutOpen(true)}
              className="shrink-0"
            >
              <LogOut className="size-4" />
              Sign out everywhere
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out everywhere?</DialogTitle>
            <DialogDescription>
              Every device logged into this account — including this one — will
              be signed out and will need to log in again. You&apos;ll be
              redirected to the login page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSignOutOpen(false)}
              disabled={signingOut}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onSignOutEverywhere}
              disabled={signingOut}
            >
              {signingOut ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing out…
                </>
              ) : (
                'Sign out everywhere'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
