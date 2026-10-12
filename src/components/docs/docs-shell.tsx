'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BookOpen, Briefcase, Menu, Webhook, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { docHref, DOCS_NAV } from '@/lib/docs/nav';
import { DocsSearch } from './docs-search';

/**
 * Two-column docs shell: a topic sidebar (desktop static, mobile
 * drawer) plus the page content. Deliberately separate from the
 * dashboard's <Sidebar> (components/layout/sidebar.tsx) — this one is
 * public, has no auth/entitlements/unread-count concerns, and its nav
 * data is the flat DOCS_NAV list rather than the app's route tree.
 *
 * Styled with the same lp2 tokens as `/` (ink, cream, paper) but none
 * of its stickers/blobs/hard shadows — see docs/layout.tsx.
 */
export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(64);
  const [searchHeight, setSearchHeight] = useState(69);

  // Close mobile drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Track sticky header height (accounts for announcement bar appearing/dismissing)
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const updateHeader = () => {
      setHeaderHeight(header.offsetHeight);
    };
    updateHeader();
    const ro = new ResizeObserver(updateHeader);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  // Track search bar height dynamically
  useEffect(() => {
    if (!searchRef.current) return;
    const updateSearch = () => {
      if (searchRef.current) {
        setSearchHeight(searchRef.current.offsetHeight);
      }
    };
    updateSearch();
    const ro = new ResizeObserver(updateSearch);
    ro.observe(searchRef.current);
    return () => ro.disconnect();
  }, []);

  const topOffset = headerHeight + searchHeight;

  return (
    <div
      style={
        {
          '--docs-header-h': `${headerHeight}px`,
          '--docs-search-h': `${searchHeight}px`,
          '--docs-top-offset': `${topOffset}px`,
        } as React.CSSProperties
      }
    >
      {/* Master search — fixed across the top of docs below the Lp2 nav header */}
      <div
        ref={searchRef}
        className="fixed inset-x-0 z-30 border-b border-(--lp2-ink)/10 bg-white/95 backdrop-blur-md"
        style={{ top: `${headerHeight}px` }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <DocsSearch />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex shrink-0 items-center gap-2 !rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-(--lp2-ink) hover:bg-gray-50 lg:hidden"
            style={{ borderRadius: 6, borderColor: '#e5e7eb' }}
          >
            <Menu className="size-4" />
            <span className="sr-only sm:not-sr-only">Browse</span>
          </button>
        </div>
      </div>

      {/* Spacer pushing normal flow below the fixed search bar */}
      <div style={{ height: `${searchHeight}px` }} aria-hidden="true" />

      {/* Docs layout: left fixed panel + scrollable main content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex gap-10 py-8 lg:py-12">
          {/* Fixed docs navigation sidebar */}
          <DocsNav pathname={pathname} mobileOpen={open} onClose={() => setOpen(false)} />

          {/* Desktop placeholder column to preserve flex layout while DocsNav is fixed */}
          <div className="hidden lg:block lg:w-56 lg:shrink-0" aria-hidden="true" />

          {/* Main content */}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
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
  const isApiActive = pathname === '/docs/api-and-integrations';
  const isToolsActive = pathname === '/qr-generator' || pathname.startsWith('/tools');
  const isDocsActive = !isApiActive && !isToolsActive;

  return (
    <>
      {/* Mobile backdrop */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-(--lp2-ink)/50 transition-opacity lg:hidden',
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <nav
        aria-label="Docs topics"
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto border-r border-(--lp2-ink)/10 bg-white p-5 transition-transform duration-200 ease-out',
          'lg:fixed lg:top-[var(--docs-top-offset,133px)] lg:bottom-0 lg:left-[max(1.5rem,calc(50vw-40rem+1.5rem))] lg:z-20 lg:w-56 lg:shrink-0 lg:translate-x-0 lg:border-r-0 lg:bg-transparent lg:p-0 lg:pt-8 lg:pb-12 lg:pr-3 docs-nav-scroll',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <span className="text-sm font-bold text-(--lp2-ink)">Docs</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex size-8 items-center justify-center rounded-md text-(--lp2-ink-soft) hover:bg-(--lp2-ink)/5"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Top section links */}
        <div className="mb-6 space-y-1 border-b border-gray-200/80 pb-5">
          <Link
            href="/docs"
            onClick={onClose}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors',
              isDocsActive
                ? 'text-[#1c8544] hover:bg-[#1c8544]/5'
                : 'text-gray-700 hover:bg-gray-100/70 hover:text-gray-900',
            )}
          >
            <span
              className={cn(
                'docs-section-icon flex size-7 shrink-0 items-center justify-center rounded-[7px] transition-colors',
                isDocsActive
                  ? 'bg-[#1c8544] text-white shadow-xs'
                  : 'border border-gray-200/90 bg-white text-gray-500 shadow-2xs',
              )}
              style={{ borderRadius: 7 }}
            >
              <BookOpen className="size-4" strokeWidth={2.2} />
            </span>
            <span className={cn('text-sm', isDocsActive ? 'font-bold' : 'font-medium')}>
              Documentation
            </span>
          </Link>

          <Link
            href="/docs/api-and-integrations"
            onClick={onClose}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors',
              isApiActive
                ? 'text-[#1c8544] hover:bg-[#1c8544]/5'
                : 'text-gray-700 hover:bg-gray-100/70 hover:text-gray-900',
            )}
          >
            <span
              className={cn(
                'docs-section-icon flex size-7 shrink-0 items-center justify-center rounded-[7px] transition-colors',
                isApiActive
                  ? 'bg-[#1c8544] text-white shadow-xs'
                  : 'border border-gray-200/90 bg-white text-gray-500 shadow-2xs',
              )}
              style={{ borderRadius: 7 }}
            >
              <Webhook className="size-4" strokeWidth={2} />
            </span>
            <span className={cn('text-sm', isApiActive ? 'font-bold' : 'font-medium')}>
              APIs &amp; Webhooks
            </span>
          </Link>

          <Link
            href="/qr-generator"
            onClick={onClose}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors',
              isToolsActive
                ? 'text-[#1c8544] hover:bg-[#1c8544]/5'
                : 'text-gray-700 hover:bg-gray-100/70 hover:text-gray-900',
            )}
          >
            <span
              className={cn(
                'docs-section-icon flex size-7 shrink-0 items-center justify-center rounded-[7px] transition-colors',
                isToolsActive
                  ? 'bg-[#1c8544] text-white shadow-xs'
                  : 'border border-gray-200/90 bg-white text-gray-500 shadow-2xs',
              )}
              style={{ borderRadius: 7 }}
            >
              <Briefcase className="size-4" strokeWidth={2} />
            </span>
            <span className={cn('text-sm', isToolsActive ? 'font-bold' : 'font-medium')}>
              Free Tools
            </span>
          </Link>
        </div>

        <div className="space-y-7">
          {DOCS_NAV.map((category) => (
            <div key={category.label}>
              <p className="docs-category-heading px-1 text-[13px] font-bold text-(--lp2-ink)">
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
                          'flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                          active
                            ? 'bg-(--lp2-grass)/10 text-(--lp2-grass-deep)'
                            : 'text-(--lp2-ink-soft) hover:bg-(--lp2-ink)/5 hover:text-(--lp2-ink)',
                        )}
                      >
                        <span className="truncate">{page.title}</span>
                        {page.badge && (
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase',
                              page.badge === 'Coming soon'
                                ? 'bg-(--lp2-ink)/8 text-(--lp2-ink-soft)'
                                : 'bg-(--lp2-tangerine-soft) text-(--lp2-tangerine)',
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
