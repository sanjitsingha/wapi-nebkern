'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useAvailability } from '@/hooks/use-availability';
import { useSupportUnread } from '@/hooks/use-support-unread';
import {
  useWhatsAppInfo,
  qualityRatingLabel,
  messagingTierLabel,
} from '@/hooks/use-whatsapp-info';
// Phosphor, matching the sidebar it sits above — see the note there on
// why the nav chrome moved off Lucide.
import {
  Gauge,
  Gear,
  Headset,
  List as MenuIcon,
  ShieldCheck,
  SignOut,
  WhatsappLogo,
} from '@phosphor-icons/react';
import { BrandLogo } from '@/components/brand/logo';
import { SupportDialog } from '@/components/support/support-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { PresenceDot } from '@/components/presence/presence-dot';
import { NotificationsBell } from '@/components/layout/notifications-bell';
import { TrialStatusChip } from '@/components/billing/trial-status-chip';

interface HeaderProps {
  /** Wired to the shell's drawer state. Used only on mobile — the
   *  hamburger button is hidden on lg+. */
  onOpenSidebar?: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const { profile, signOut } = useAuth();
  const { available, setAvailable } = useAvailability();
  const waInfo = useWhatsAppInfo();
  const supportUnread = useSupportUnread();
  const [supportOpen, setSupportOpen] = useState(false);

  // Meta health signals. Both resolve to null when Meta didn't return them
  // (or the health call failed), in which case the rows are omitted.
  const quality = qualityRatingLabel(waInfo?.quality_rating);
  const tier = messagingTierLabel(waInfo?.messaging_limit_tier);

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    'U';

  return (
    <>
    <header className="border-border bg-background flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {/* Logo — always visible in the header. The full lockup rather
            than the mark alone: at this height the wordmark still reads
            on a phone, so there is nothing left to hide below `sm`. */}
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center"
          title="Dashboard"
        >
          <BrandLogo priority className="h-7" />
        </Link>

        {/* Hamburger — mobile only */}
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-10 w-10 items-center justify-center rounded-md transition-colors lg:hidden"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {/* First in the right-hand group, ahead of the bell: it is
            status rather than an action, and it renders nothing at all
            on a paid account — so the icons keep their usual positions
            for everyone past the trial. */}
        <TrialStatusChip />
        <NotificationsBell />



        <DropdownMenu>
          <DropdownMenuTrigger
            className="hover:bg-muted/70 focus:bg-muted/70 data-popup-open:bg-muted/70 flex items-center gap-2 rounded-md px-1 py-1 transition-colors focus:outline-none sm:gap-3 sm:pr-3 sm:pl-1"
            aria-label="Open account menu"
          >
            <span className="relative inline-flex">
              <Avatar className="size-8">
                {profile?.avatar_url ? (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={profile.full_name ?? 'Avatar'}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <PresenceDot
                status={available ? 'online' : 'offline'}
                className="ring-background absolute -right-0.5 -bottom-0.5 size-2.5 ring-2"
              />
            </span>
            <span className="text-foreground hidden text-sm font-medium sm:inline">
              {profile?.full_name ?? 'User'}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="bg-popover text-popover-foreground ring-border min-w-96 p-3"
          >
            {/* Who you're signed in as. Worth the room now that Settings
                has left the menu — without it this is a panel about the
                account with the account nowhere on it. */}
            <div className="mx-1 mb-2 flex items-center gap-3">
              <Avatar className="size-11">
                {profile?.avatar_url ? (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={profile.full_name ?? 'Avatar'}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-base font-medium">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-foreground truncate text-[15px] font-semibold">
                  {profile?.full_name ?? 'User'}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {profile?.email}
                </p>
              </div>
            </div>

            {/* Availability toggle — not a menu item, so clicking the
                switch flips presence without closing the menu. */}
            <div className="bg-muted/40 mx-1 mb-1.5 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <PresenceDot status={available ? 'online' : 'offline'} />
                <div className="leading-tight">
                  <p className="text-foreground text-[15px] font-medium">
                    {available ? 'Available' : 'Unavailable'}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {available
                      ? 'Shown online to your team'
                      : 'Shown offline to your team'}
                  </p>
                </div>
              </div>
              <Switch
                checked={available}
                onCheckedChange={setAvailable}
                aria-label="Toggle availability"
              />
            </div>

            {/* WhatsApp connected account */}
            {waInfo && (
              <div className="mx-1 flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10">
                  <WhatsappLogo
                    className="h-4.5 w-4.5 text-[#25D366]"
                    weight="fill"
                  />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-foreground">
                    {waInfo.verified_name ?? 'WhatsApp Business'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {waInfo.display_phone_number}
                  </p>
                </div>
                <span className="ml-auto shrink-0 rounded-full bg-[#25D366]/10 px-2 py-0.5 text-[11px] font-medium text-[#25D366]">
                  Connected
                </span>
              </div>
            )}

            {/* Meta health signals for the number. Each row only renders once
                Meta actually returns it — /api/whatsapp/phone-health degrades
                to "unknown" silently, so a missing row means "not available",
                never an error. */}
            {waInfo && (quality || tier) && (
              <div className="mx-1 mt-1.5 rounded-xl border border-border px-3 py-2.5">
                {tier && (
                  <div className="flex items-center justify-between gap-3 py-1">
                    <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                      <Gauge className="h-4 w-4" />
                      Messaging tier
                    </span>
                    <span className="text-[13px] font-medium text-foreground tabular-nums">
                      {tier}
                    </span>
                  </div>
                )}
                {quality && (
                  <div className="flex items-center justify-between gap-3 py-1">
                    <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                      <ShieldCheck className="h-4 w-4" />
                      Quality rating
                    </span>
                    <span className={`text-[13px] font-medium ${quality.tone}`}>
                      {quality.label}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Settings & Sign out */}
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuItem
              render={<Link href="/settings" />}
              className="gap-2.5 rounded-lg px-3 py-2.5 text-[15px] font-medium cursor-pointer text-foreground hover:bg-muted"
            >
              <Gear className="h-4.5 w-4.5 text-muted-foreground" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSupportOpen(true)}
              className="gap-2.5 rounded-lg px-3 py-2.5 text-[15px] font-medium cursor-pointer text-foreground hover:bg-muted"
            >
              <span className="relative flex">
                <Headset className="h-4.5 w-4.5 text-muted-foreground" />
                {supportUnread > 0 && (
                  <span className="bg-primary ring-popover absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2" />
                )}
              </span>
              Support
              {supportUnread > 0 && (
                <span className="bg-primary-soft text-primary ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums">
                  {supportUnread > 99 ? '99+' : supportUnread}
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={signOut}
              className="text-destructive data-highlighted:text-destructive gap-2.5 rounded-lg px-3 py-2.5 text-[15px] font-medium cursor-pointer"
            >
              <SignOut className="h-4.5 w-4.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    <SupportDialog open={supportOpen} onOpenChange={setSupportOpen} />
    </>
  );
}
