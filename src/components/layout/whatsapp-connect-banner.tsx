'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, MessageSquareWarning } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';

/**
 * "You haven't connected WhatsApp yet" — a thin bar under the header.
 *
 * The only full-width band left there: the trial notice that used to
 * share the slot is a chip in the header now. This one stays a bar
 * because it is a blocking setup step rather than a countdown, and it
 * needs room for a sentence that explains itself.
 *
 * Nothing in this product works until a number is connected: no
 * sending, no receiving, no campaigns. An empty inbox does not explain
 * that, so the nudge lives where it cannot be missed rather than on a
 * settings page nobody has opened.
 *
 * WHO SEES IT
 *
 * Only people who can act on it. Connecting a number is a settings
 * change, so an agent or a viewer gets nothing — telling someone to fix
 * a thing they have no permission to fix is just noise on every page.
 *
 * It also stays quiet on the screens that ARE the fix: a banner
 * pointing at the page you are already looking at reads as a bug.
 */

type Connection = {
  connected: boolean;
  /** 'no_config' — never set up. 'token_corrupted' — set up once, but
   *  the stored token no longer decrypts (usually a changed
   *  ENCRYPTION_KEY). Different sentence, different fix. */
  reason?: string;
};

const SILENT_PATHS = ['/settings/whatsapp', '/settings/meta'];

export function WhatsAppConnectBanner() {
  const { canEditSettings } = useAuth();
  const pathname = usePathname();
  const [conn, setConn] = useState<Connection | null>(null);

  const onSetupScreen = SILENT_PATHS.some((p) => pathname?.startsWith(p));
  const shouldCheck = canEditSettings && !onSetupScreen;

  useEffect(() => {
    if (!shouldCheck) return;
    let cancelled = false;
    fetch('/api/whatsapp/connection')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && typeof data?.connected === 'boolean') setConn(data);
      })
      .catch(() => {
        /* network hiccup — just don't show the banner */
      });
    return () => {
      cancelled = true;
    };
  }, [shouldCheck]);

  if (!shouldCheck) return null;
  // `null` is "we don't know yet". Rendering nothing until the answer
  // arrives keeps a connected account from seeing the bar flash up on
  // every page load.
  if (!conn || conn.connected) return null;

  const needsReauth = conn.reason === 'token_corrupted';

  return (
    // NO `dark:` variant here, deliberately, and it is not an oversight.
    //
    // This app is light-only: lib/themes.ts declares `type Mode =
    // "light"`, the ThemeProvider is a fixed stub, and nothing ever
    // puts a `dark` class on the document. But Tailwind v4 resolves
    // `dark:` through `prefers-color-scheme` unless told otherwise, so
    // a `dark:` utility fires off the visitor's OS setting while the
    // page around it stays light. A pale `dark:text-amber-200` then
    // lands on a pale background and all but vanishes — which is
    // exactly what this banner did on an OS set to dark.
    //
    // One colour, chosen against the light background this app always
    // renders. amber-950 and semibold because the bar has to survive
    // being ignored on every page.
    <div className="flex items-center justify-center gap-2.5 border-b border-amber-500/40 bg-amber-500/15 px-4 py-3 text-center text-sm font-semibold text-amber-950">
      <MessageSquareWarning className="size-4 shrink-0" />
      <span>
        {needsReauth
          ? 'Your WhatsApp connection needs re-authorising — messages cannot be sent or received.'
          : 'Connect your WhatsApp number to start sending and receiving messages.'}
      </span>
      <Link
        href="/settings/whatsapp"
        className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:no-underline"
      >
        {needsReauth ? 'Fix it' : 'Connect now'}
        <ArrowRight className="size-4 shrink-0" />
      </Link>
    </div>
  );
}
