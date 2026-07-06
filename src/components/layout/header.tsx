'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useAvailability } from '@/hooks/use-availability';
import { useWhatsAppInfo } from '@/hooks/use-whatsapp-info';
import { LogOut, Menu, MessageSquare, Settings as SettingsIcon, User, MessageCircle } from 'lucide-react';
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

interface HeaderProps {
  /** Wired to the shell's drawer state. Used only on mobile — the
   *  hamburger button is hidden on lg+. */
  onOpenSidebar?: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const { profile, signOut } = useAuth();
  const { available, setAvailable } = useAvailability();
  const waInfo = useWhatsAppInfo();

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    'U';

  return (
    <header className="border-border bg-background flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {/* Logo — always visible in the header */}
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2"
          title="Dashboard"
        >
          <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <MessageSquare className="h-4 w-4" />
          </div>
          <span className="text-foreground hidden text-sm font-semibold tracking-tight sm:block">
            wacrm
          </span>
        </Link>

        {/* Hamburger — mobile only */}
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-10 w-10 items-center justify-center rounded-md transition-colors lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <NotificationsBell />

        <Link
          href="/settings"
          aria-label="Settings"
          title="Settings"
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-10 w-10 items-center justify-center rounded-md transition-colors"
        >
          <SettingsIcon className="h-5 w-5" />
        </Link>

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
            sideOffset={6}
            className="bg-popover text-popover-foreground ring-border min-w-80 p-2"
          >
            {/* Identity block */}
            <div className="flex items-center gap-3 px-2 py-2.5">
              <Avatar className="size-10">
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
                <p className="text-foreground truncate text-sm font-semibold">
                  {profile?.full_name ?? 'User'}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {profile?.email ?? ''}
                </p>
              </div>
            </div>

            {/* Availability toggle — not a menu item, so clicking the
                switch flips presence without closing the menu. */}
            <div className="bg-muted/40 mx-1 mb-1 flex items-center justify-between gap-3 rounded-lg px-2.5 py-2">
              <div className="flex items-center gap-2">
                <PresenceDot status={available ? 'online' : 'offline'} />
                <div className="leading-tight">
                  <p className="text-foreground text-sm font-medium">
                    {available ? 'Available' : 'Unavailable'}
                  </p>
                  <p className="text-muted-foreground text-[11px]">
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
              <>
                <div className="mx-1 mb-1 flex items-center gap-3 rounded-lg border border-border px-2.5 py-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10">
                    <MessageCircle className="h-4 w-4 text-[#25D366]" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {waInfo.verified_name ?? 'WhatsApp Business'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {waInfo.display_phone_number}
                    </p>
                  </div>
                  <span className="ml-auto shrink-0 rounded-full bg-[#25D366]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#25D366]">
                    Connected
                  </span>
                </div>
              </>
            )}

            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              render={
                <Link
                  href="/settings/profile"
                  className="text-popover-foreground focus:bg-accent focus:text-accent-foreground py-2"
                />
              }
            >
              <User className="size-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <Link
                  href="/settings/whatsapp"
                  className="text-popover-foreground focus:bg-accent focus:text-accent-foreground py-2"
                />
              }
            >
              <SettingsIcon className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={signOut}
              className="text-popover-foreground focus:bg-accent focus:text-accent-foreground py-2"
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
