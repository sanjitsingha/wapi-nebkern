import { MessageSquare, Zap, GitBranch, Hourglass } from 'lucide-react'

/**
 * Miniature flow-builder for the Automations feature spotlight.
 * Mirrors the real builder's look (trigger + stepped cards + arrows)
 * but is pure presentation — no interactivity.
 */
export function AutomationMock() {
  const steps = [
    {
      kind: 'trigger',
      label: 'First Message from Contact',
      icon: Zap,
      accent: 'border-l-blue-500',
      badgeClass: 'bg-blue-500/10 text-blue-400',
      kindLabel: 'TRIGGER',
    },
    {
      kind: 'action',
      label: 'Send "Hi! 👋 Thanks for reaching out."',
      icon: MessageSquare,
      accent: 'border-l-emerald-500',
      badgeClass: 'bg-emerald-500/10 text-emerald-400',
      kindLabel: 'ACTION',
    },
    {
      kind: 'wait',
      label: 'Wait 10 minutes',
      icon: Hourglass,
      accent: 'border-l-slate-500',
      badgeClass: 'bg-slate-500/10 text-slate-400',
      kindLabel: 'WAIT',
    },
    {
      kind: 'condition',
      label: 'If tag = "lead" → assign to sales',
      icon: GitBranch,
      accent: 'border-l-amber-500',
      badgeClass: 'bg-amber-500/10 text-amber-400',
      kindLabel: 'CONDITION',
    },
  ]

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
      <div className="flex items-center gap-1.5 border-b border-slate-800 bg-slate-900 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
        <span className="ml-3 text-[10px] text-slate-500">
          Automations — CRM Template for WhatsApp
        </span>
      </div>

      {/* Dotted canvas — matches the real flow builder's background. */}
      <div
        className="relative flex flex-col items-center gap-0 px-6 py-6"
        style={{
          backgroundImage: 'radial-gradient(circle, rgb(30 41 59) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      >
        {steps.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="flex w-full max-w-xs flex-col items-center">
              {i > 0 && <div className="h-4 w-px bg-slate-700" aria-hidden />}
              <div
                className={`w-full rounded-lg border border-slate-800 border-l-4 bg-slate-900 px-3 py-2 ${s.accent}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-md ${s.badgeClass}`}
                  >
                    <Icon className="h-3 w-3" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                      {s.kindLabel}
                    </div>
                    <div className="truncate text-[11px] font-medium text-white">
                      {s.label}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
