'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, Loader2 } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { LOGO_URL, logoWidthFor } from '@/lib/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function AdminLoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialError =
    searchParams.get('error') === 'not_authorized'
      ? 'That account is not an admin.'
      : null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      // Verify the session is an allowlisted admin before entering. A
      // signed-in-but-not-admin user is bounced back out immediately.
      const res = await fetch('/admin/api/me', { cache: 'no-store' });
      const data = (await res.json()) as { admin: boolean };
      if (!data.admin) {
        await supabase.auth.signOut();
        setError('That account is not an admin.');
        return;
      }
      router.replace('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Image
            src={LOGO_URL}
            alt="Instant"
            width={logoWidthFor(32)}
            height={32}
            priority
          />
          {/* The shield moved inline with the heading rather than
              sitting in its own tile above it — with a real logo on the
              page, two stacked marks read as clutter, but the "this is
              a restricted area" cue is still worth keeping. */}
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-foreground flex items-center gap-1.5 text-lg font-semibold">
              <ShieldCheck className="text-primary size-4" />
              Admin panel
            </h1>
            <p className="text-muted-foreground text-sm">
              Sign in with an authorized admin account.
            </p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="border-border bg-card space-y-4 rounded-2xl border p-6"
        >
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {error && (
            <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-xs">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading || !email || !password}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 w-full disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginInner />
    </Suspense>
  );
}
