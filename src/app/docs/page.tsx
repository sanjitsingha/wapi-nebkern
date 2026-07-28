import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { DOCS_NAV, docHref } from '@/lib/docs/nav';
import { cn } from '@/lib/utils';

export default function DocsIndexPage() {
  return (
    <div className="max-w-4xl">
      <p className="text-sm font-bold text-(--lp2-grass-deep)">Documentation</p>
      <h1 className="lp2-display mt-2 text-3xl font-extrabold text-balance sm:text-4xl">
        Everything wacrm can do
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-(--lp2-ink-soft) text-pretty">
        Channel setup, the shared inbox, CRM, campaigns, automations, AI
        agents, billing, and the API — every option explained in detail, in
        the same terms the product itself uses. Start with{' '}
        <Link href={docHref('getting-started')} className="font-semibold text-(--lp2-grass-deep) underline decoration-(--lp2-grass)/30 underline-offset-2 hover:decoration-(--lp2-grass-deep)">
          Getting started
        </Link>{' '}
        if you&apos;re new.
      </p>

      <div className="mt-14 space-y-12">
        {DOCS_NAV.map((category) => (
          <div key={category.label}>
            <h2 className="text-lg font-bold text-(--lp2-ink)">{category.label}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {category.pages.map((page) => (
                <Link
                  key={page.slug}
                  href={docHref(page.slug)}
                  className="group flex flex-col gap-2 rounded-xl border border-(--lp2-ink)/10 bg-(--lp2-paper) p-5 transition-all hover:-translate-y-0.5 hover:border-(--lp2-grass)/30 hover:shadow-md"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--lp2-grass)/10 text-(--lp2-grass-deep)">
                      <page.icon className="size-4.5" />
                    </span>
                    <span className="flex items-center gap-2 text-sm font-bold text-(--lp2-ink) group-hover:text-(--lp2-grass-deep)">
                      {page.title}
                      {page.badge && (
                        <span
                          className={cn(
                            'rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase',
                            page.badge === 'Coming soon'
                              ? 'bg-(--lp2-ink)/8 text-(--lp2-ink-soft)'
                              : 'bg-(--lp2-tangerine-soft) text-(--lp2-tangerine)',
                          )}
                        >
                          {page.badge}
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-(--lp2-ink-soft)">
                    {page.description}
                  </p>
                  <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-(--lp2-grass-deep) opacity-0 transition-opacity group-hover:opacity-100">
                    Read more <ArrowRight className="size-3" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 rounded-2xl border border-(--lp2-ink)/10 bg-(--lp2-paper) p-7 text-center">
        <p className="text-base font-bold text-(--lp2-ink)">
          Can&apos;t find what you&apos;re looking for?
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-(--lp2-ink-soft)">
          The in-app Support panel reaches our team directly — open it from
          the sidebar footer once you&apos;re signed in.
        </p>
        <Link
          href="/signup"
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-(--lp2-grass) px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-(--lp2-grass-deep)"
        >
          Start free trial
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
