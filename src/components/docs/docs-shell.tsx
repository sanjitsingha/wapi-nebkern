'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { softBadge } from '@/lib/badge-colors';
import { docHref, DOCS_NAV } from '@/lib/docs/nav';

/**
 * Two-column docs shell: a topic sidebar (desktop static, mobile
 * drawer) plus the page content. Deliberately separate from the
 * dashboard's <Sidebar> (components/layout/sidebar.tsx) — this one is
 * public, has no auth/entitlements/unread-count concerns, and its nav
 * data is the flat DOCS_NAV list rather than the app's route tree.
 */
export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* Mobile topic toggle — the sidebar is a drawer below lg. */}
      <div className="flex items-center gap-2 border-b border-border py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground"
        >
          <Menu className="size-4" />
          Browse docs
        </button>
      </div>

      <div className="flex gap-10 py-8 lg:py-12">
        <DocsNav pathname={pathname} mobileOpen={open} onClose={() => setOpen(false)} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function DocsNav({
  pathname,
  mobileOpen,
  onClose,
}: {
  pathname: string;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* Mobile backdrop */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden',
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <nav
        aria-label="Docs topics"
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto border-r border-border bg-card p-5 transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-0 lg:h-[calc(100vh-1px)] lg:w-56 lg:shrink-0 lg:translate-x-0 lg:border-r-0 lg:bg-transparent lg:p-0 lg:pt-12',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <span className="text-sm font-semibold text-foreground">Docs</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-7">
          {DOCS_NAV.map((category) => (
            <div key={category.label}>
              <p className="px-1 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
                {category.label}
              </p>
              <ul className="mt-2 space-y-0.5">
                {category.pages.map((page) => {
                  const href = docHref(page.slug);
                  const active = pathname === href;
                  return (
                    <li key={page.slug}>
                      <Link
                        href={href}
                        onClick={onClose}
                        className={cn(
                          'flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                          active
                            ? 'bg-primary-soft text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        <span className="truncate">{page.title}</span>
                        {page.badge && (
                          <span
                            className={cn(
                              'shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase',
                              page.badge === 'Coming soon' ? softBadge.neutral : softBadge.amber,
                            )}
                          >
                            {page.badge === 'Coming soon' ? 'Soon' : page.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}
