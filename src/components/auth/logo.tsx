'use client';

import Link from 'next/link';
import { ChatCircleDots } from '@phosphor-icons/react';

// The same mark the signed-in header shows, so the logo doesn't change
// shape the moment a user gets through the door. Links home rather than
// to /dashboard — nobody on these pages has a session yet.
export function AuthLogo() {
  return (
    <Link href="/" className="mb-10 flex w-fit items-center gap-2.5">
      <div className="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-lg">
        <ChatCircleDots className="h-5 w-5" weight="fill" />
      </div>
      <span className="text-foreground text-lg font-semibold tracking-tight">
        Instant
      </span>
    </Link>
  );
}
