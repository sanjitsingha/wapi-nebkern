'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';

// ============================================================
// The account ID — the short, permanent number (migration 123) a
// customer quotes to support, who search the admin by it.
//
// Read on its own rather than in the profile query: that query signs
// everyone in, and must not fail on a column a not-yet-migrated
// database lacks. One read per account per page load, shared by every
// place that shows it.
// ============================================================

const numbers = new Map<string, Promise<number | null>>();

function loadAccountNumber(accountId: string): Promise<number | null> {
  let pending = numbers.get(accountId);
  if (!pending) {
    pending = Promise.resolve(
      createClient().from('accounts').select('account_number').eq('id', accountId).maybeSingle(),
    ).then(({ data, error }) => {
      if (error) numbers.delete(accountId); // try again next time
      const n = (data as { account_number?: unknown } | null)?.account_number;
      return typeof n === 'number' ? n : null;
    });
    numbers.set(accountId, pending);
  }
  return pending;
}

/** This account's ID, or null until it loads (or if it has none). */
export function useAccountNumber(): number | null {
  const { accountId } = useAuth();
  const [loaded, setLoaded] = useState<{ accountId: string; number: number | null } | null>(null);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    void loadAccountNumber(accountId).then((number) => {
      if (!cancelled) setLoaded({ accountId, number });
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  return loaded && loaded.accountId === accountId ? loaded.number : null;
}

/** "Account ID 100245", copied on click. Renders nothing until known. */
export function AccountId({ className }: { className?: string }) {
  const number = useAccountNumber();
  const [copied, setCopied] = useState(false);
  if (number == null) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(number));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Clipboard blocked — copy the ID manually');
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title="Copy account ID"
      className={cn(
        'text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px] transition-colors',
        className,
      )}
    >
      Account ID <span className="font-mono tabular-nums">{number}</span>
      {copied ? <Check className="text-primary size-3" /> : <Copy className="size-3" />}
    </button>
  );
}
