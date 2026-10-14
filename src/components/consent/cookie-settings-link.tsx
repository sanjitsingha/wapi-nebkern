'use client';

import { resetCookieConsent } from '@/lib/cookie-consent';

/**
 * "Cookie settings" — reopens the consent prompt so a visitor can change
 * their answer at any time, as the Cookie Policy promises. A button, not
 * a link: it does not navigate anywhere.
 */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => resetCookieConsent()} className={className}>
      Cookie settings
    </button>
  );
}
