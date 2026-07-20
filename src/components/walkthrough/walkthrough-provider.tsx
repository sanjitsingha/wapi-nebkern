'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { WALKTHROUGH_STEPS } from '@/lib/walkthrough/steps';
import { WalkthroughOverlay } from './walkthrough-overlay';

interface WalkthroughContextValue {
  /** Replay the tour from the top — wired to the sidebar button. */
  start: () => void;
  active: boolean;
}

const WalkthroughContext = createContext<WalkthroughContextValue | null>(null);

// The anchors live in the sidebar and header, which mount with the
// shell. Give the first paint a beat to settle so step 2 measures a
// real box instead of a zero-size one mid-mount.
const AUTOSTART_DELAY_MS = 700;

/**
 * Owns walkthrough state and decides when the tour runs.
 *
 * Persistence deliberately uses its own query against
 * `profiles.walkthrough_completed_at` rather than extending the shared
 * fetch in use-auth. If migration 067 hasn't been applied, that column
 * doesn't exist — folding it into the auth provider's select would fail
 * the whole profile fetch and lock users out of the app. Isolated here,
 * the same failure degrades to "no tour" and nothing else.
 */
export function WalkthroughProvider({ children }: { children: ReactNode }) {
  const { user, profileLoading } = useAuth();
  // Hoisted rather than read as `user?.id` inside the callbacks below:
  // the React Compiler infers `user` as the dependency of an optional
  // chain and then refuses to preserve the narrower manual dep list.
  const userId = user?.id ?? null;
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  // Guards the auto-start check so it runs once per session, not on
  // every auth-state change (token refresh re-fires the listener).
  const checkedRef = useRef(false);

  const active = stepIndex !== null;

  const start = useCallback(() => setStepIndex(0), []);

  const persistCompletion = useCallback(async (userId: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({ walkthrough_completed_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) {
        // Non-fatal: the tour still closes for this session. Worst case
        // it reappears next login, which beats blocking the UI on a
        // write the user didn't ask for.
        console.warn('[walkthrough] could not save completion:', error.message);
      }
    } catch (err) {
      console.warn('[walkthrough] completion write threw:', err);
    }
  }, []);

  const finish = useCallback(() => {
    setStepIndex(null);
    if (userId) void persistCompletion(userId);
  }, [userId, persistCompletion]);

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i === null) return null;
      if (i >= WALKTHROUGH_STEPS.length - 1) return i; // `Done` calls finish()
      return i + 1;
    });
  }, []);

  const prev = useCallback(() => {
    setStepIndex((i) => (i === null || i === 0 ? i : i - 1));
  }, []);

  // Auto-start for anyone who has never completed it. A NULL timestamp
  // means "never seen"; migration 067 backfills existing users to now()
  // so only genuinely new sign-ups get pulled into the tour.
  useEffect(() => {
    if (checkedRef.current) return;
    if (profileLoading || !userId) return;
    checkedRef.current = true;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    void (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('profiles')
          .select('walkthrough_completed_at')
          .eq('user_id', userId)
          .maybeSingle();

        // Fail closed: an error here is most likely the un-migrated
        // column, and silently skipping the tour is far better than
        // showing it to every user on every load.
        if (cancelled || error || !data) return;
        if (data.walkthrough_completed_at !== null) return;

        timer = setTimeout(() => {
          if (!cancelled) setStepIndex(0);
        }, AUTOSTART_DELAY_MS);
      } catch {
        // Same reasoning — stay quiet.
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId, profileLoading]);

  const value = useMemo<WalkthroughContextValue>(
    () => ({ start, active }),
    [start, active],
  );

  return (
    <WalkthroughContext.Provider value={value}>
      {children}
      {stepIndex !== null && (
        <WalkthroughOverlay
          stepIndex={stepIndex}
          onNext={next}
          onPrev={prev}
          onFinish={finish}
        />
      )}
    </WalkthroughContext.Provider>
  );
}

/**
 * Read walkthrough controls. Returns an inert no-op outside the
 * provider so a component rendered in isolation (tests, storybook)
 * doesn't crash — matching how useAuth degrades.
 */
export function useWalkthrough(): WalkthroughContextValue {
  return (
    useContext(WalkthroughContext) ?? { start: () => {}, active: false }
  );
}
