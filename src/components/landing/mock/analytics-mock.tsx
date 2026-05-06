/**
 * Miniature analytics panel with a line chart + 3 stat tiles.
 * Shown alongside the dashboard feature spotlight. SVG rendered
 * inline so there's no image to load.
 */
export function AnalyticsMock() {
  // Pre-sampled line data so the curve looks "realistic" without
  // being random (we want the same pleasing shape on every render).
  const incoming = [4, 6, 3, 7, 9, 6, 11, 14, 10, 13, 16, 18, 15, 22]
  const outgoing = [3, 5, 2, 6, 7, 5, 9, 12, 9, 11, 14, 15, 13, 19]

  const VB_W = 320
  const VB_H = 120
  const PAD = { top: 8, right: 10, bottom: 10, left: 24 }
  const chartW = VB_W - PAD.left - PAD.right
  const chartH = VB_H - PAD.top - PAD.bottom
  const maxY = Math.max(...incoming, ...outgoing)
  const stepX = chartW / (incoming.length - 1)
  const y = (v: number) => PAD.top + chartH - (v / maxY) * chartH
  const x = (i: number) => PAD.left + i * stepX
  const path = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
      <div className="flex items-center gap-1.5 border-b border-slate-800 bg-slate-900 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
        <span className="ml-3 text-[10px] text-slate-500">
          Dashboard — CRM Template for WhatsApp
        </span>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Open convos', value: '42', delta: '+5', positive: true },
            { label: 'New today', value: '18', delta: '+3', positive: true },
            { label: 'Avg reply', value: '3.2m', delta: '-0.4m', positive: true },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
            >
              <div className="text-[10px] text-slate-500">{s.label}</div>
              <div className="mt-0.5 text-lg font-bold text-white tabular-nums">
                {s.value}
              </div>
              <div
                className={`text-[10px] tabular-nums ${
                  s.positive ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {s.delta}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-white">
              Conversations over time
            </span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-[9px] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Incoming
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Outgoing
              </span>
            </div>
          </div>
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className="h-28 w-full"
            role="img"
            aria-label="Sample conversations chart"
          >
            {[0, 0.5, 1].map((t) => (
              <line
                key={t}
                x1={PAD.left}
                x2={VB_W - PAD.right}
                y1={PAD.top + chartH * t}
                y2={PAD.top + chartH * t}
                stroke="rgb(30 41 59)"
                strokeDasharray="3 3"
              />
            ))}
            <path d={path(outgoing)} fill="none" stroke="#10b981" strokeWidth={1.5} />
            <path d={path(incoming)} fill="none" stroke="#3b82f6" strokeWidth={1.5} />
          </svg>
        </div>
      </div>
    </div>
  )
}
