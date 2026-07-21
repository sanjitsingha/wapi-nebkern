import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { DOCS_NAV, docHref } from '@/lib/docs/nav';
import { softBadge } from '@/lib/badge-colors';
import { cn } from '@/lib/utils';

export default function DocsIndexPage() {
  return (
    <div className="max-w-4xl">
      <p className="text-sm font-semibold text-primary">Documentation</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        Everything wacrm can do
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty">
        Channel setup, the shared inbox, CRM, campaigns, automations, AI
        agents, billing, and the API — every option explained in detail, in
        the same terms the product itself uses. Start with{' '}
        <Link href={docHref('getting-started')} className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
          Getting started
        </Link>{' '}
        if you&apos;re new.
      </p>

      <div className="mt-14 space-y-12">
        {DOCS_NAV.map((category) => (
          <div key={category.label}>
            <h2 className="text-lg font-semibold text-foreground">{category.label}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {category.pages.map((page) => (
                <Link
                  key={page.slug}
                  href={docHref(page.slug)}
                  className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      <page.icon className="size-4.5" />
                    </span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground group-hover:text-primary">
                      {page.title}
                      {page.badge && (
                        <span
                          className={cn(
                            'rounded-full border px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase',
                            page.badge === 'Coming soon' ? softBadge.neutral : softBadge.amber,
                          )}
                        >
                          {page.badge}
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {page.description}
                  </p>
                  <span className="mt-1 flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Read more <ArrowRight className="size-3" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 rounded-2xl border border-border bg-card/40 p-7 text-center">
        <p className="text-base font-semibold text-foreground">
          Can&apos;t find what you&apos;re looking for?
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          The in-app Support panel reaches our team directly — open it from
          the sidebar footer once you&apos;re signed in.
        </p>
        <Link
          href="/signup"
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
        >
          Start free trial
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
