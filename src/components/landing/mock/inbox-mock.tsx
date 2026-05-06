import { MessageSquare, Search } from 'lucide-react'

/**
 * Miniature of the app's shared inbox. Pure CSS — no real data, no
 * supabase calls. Used in the hero and the inbox feature spotlight.
 * Kept stateless and presentational so the page renders fast.
 */
export function InboxMock() {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
      {/* Fake window chrome — makes the mock read as "a product", not
          an abstract component. */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 bg-slate-900 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
        <span className="ml-3 text-[10px] text-slate-500">
          Inbox — CRM Template for WhatsApp
        </span>
      </div>

      <div className="grid grid-cols-[180px_1fr] lg:grid-cols-[220px_1fr]">
        {/* Conversation list */}
        <div className="border-r border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
            <Search className="h-3 w-3 text-slate-500" />
            <span className="text-[10px] text-slate-500">Search</span>
          </div>
          {[
            { name: 'Aisha', preview: 'Thanks! Received it.', unread: false, active: true },
            { name: 'Diego', preview: 'Do you ship to Brazil?', unread: true, active: false },
            { name: 'Yuki', preview: 'Price sheet attached.', unread: false, active: false },
            { name: 'Luca', preview: 'Got it, will test.', unread: false, active: false },
          ].map((c, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 px-3 py-2.5 ${
                c.active ? 'border-l-2 border-emerald-500 bg-slate-800/60' : 'border-l-2 border-transparent'
              }`}
            >
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] font-medium text-emerald-400">
                {c.name[0]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium text-white">{c.name}</span>
                  {c.unread && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                </div>
                <p className="truncate text-[10px] text-slate-500">{c.preview}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Thread */}
        <div className="flex min-h-[280px] flex-col bg-slate-950">
          <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] font-medium text-emerald-400">
              A
            </span>
            <div>
              <div className="text-xs font-medium text-white">Aisha</div>
              <div className="text-[10px] text-slate-500">+44 7700 900123</div>
            </div>
            <div className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
              Open
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2 px-4 py-4">
            <div className="mr-auto max-w-[75%] rounded-2xl rounded-bl-sm bg-slate-800 px-3 py-2 text-xs text-slate-200">
              Hi! Is the kit available in large?
            </div>
            <div className="ml-auto max-w-[75%] rounded-2xl rounded-br-sm bg-emerald-500 px-3 py-2 text-xs text-white">
              Yes — shipping today 📦
            </div>
            <div className="mr-auto max-w-[75%] rounded-2xl rounded-bl-sm bg-slate-800 px-3 py-2 text-xs text-slate-200">
              Thanks! Received it.
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-slate-800 bg-slate-900/60 px-4 py-2.5">
            <div className="flex h-8 flex-1 items-center rounded-lg border border-slate-700 bg-slate-900 px-3 text-[10px] text-slate-500">
              Type a message…
            </div>
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
