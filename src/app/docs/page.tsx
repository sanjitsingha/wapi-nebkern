import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { listDocs } from '@/lib/docs/content'

export default async function DocsIndexPage() {
  const pages = await listDocs()
  const sections: Record<string, typeof pages> = {}
  for (const p of pages) {
    sections[p.section] ??= []
    sections[p.section].push(p)
  }

  return (
    <article className="mx-auto w-full max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
        Documentation
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
        Self-host the CRM template for WhatsApp end to end
      </h1>
      <p className="mt-4 text-base leading-relaxed text-slate-400">
        Everything you need to take the template from a fresh fork to a
        production deploy. Work through the pages in order, or jump to the
        one you need.
      </p>

      <div className="mt-10 flex flex-col gap-10">
        {Object.entries(sections).map(([section, items]) => (
          <section key={section}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {section}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((p) => (
                <Link
                  key={p.slug}
                  href={`/docs/${p.slug}`}
                  className="group flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-5 transition-colors hover:border-slate-700 hover:bg-slate-900/70"
                >
                  <h3 className="text-sm font-semibold text-white">
                    {p.title}
                  </h3>
                  {p.description && (
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                      {p.description}
                    </p>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 transition-colors group-hover:text-emerald-300">
                    Read
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  )
}
