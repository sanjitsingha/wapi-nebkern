/**
 * Miniature kanban pipeline with three stages and a handful of fake
 * deal cards. Feature-spotlight for the Pipelines section.
 */
export function PipelineMock() {
  const stages = [
    {
      name: 'Lead',
      color: 'bg-blue-500',
      deals: [
        { title: 'Acme Co', value: '$1,200' },
        { title: 'Bakery on 3rd', value: '$450' },
      ],
    },
    {
      name: 'Proposal',
      color: 'bg-amber-500',
      deals: [
        { title: 'Nova Studios', value: '$4,800' },
        { title: 'Riveria Hotel', value: '$2,100' },
        { title: 'Pine & Co', value: '$960' },
      ],
    },
    {
      name: 'Won',
      color: 'bg-emerald-500',
      deals: [{ title: 'Lagoon Spa', value: '$3,200' }],
    },
  ]

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
      <div className="flex items-center gap-1.5 border-b border-slate-800 bg-slate-900 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
        <span className="ml-3 text-[10px] text-slate-500">
          Pipelines — CRM Template for WhatsApp
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 p-4">
        {stages.map((s) => (
          <div key={s.name} className="flex flex-col gap-2 rounded-lg bg-slate-900/60 p-2">
            <div className="flex items-center gap-2 px-1">
              <span className={`h-1.5 w-1.5 rounded-full ${s.color}`} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                {s.name}
              </span>
              <span className="ml-auto text-[10px] text-slate-500 tabular-nums">
                {s.deals.length}
              </span>
            </div>
            {s.deals.map((d, i) => (
              <div
                key={i}
                className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-2"
              >
                <div className="text-[11px] font-medium text-white">{d.title}</div>
                <div className="mt-1 text-[10px] text-slate-500 tabular-nums">
                  {d.value}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
