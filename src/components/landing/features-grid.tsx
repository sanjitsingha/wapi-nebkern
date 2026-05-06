import {
  MessageSquare,
  Users,
  GitBranch,
  Radio,
  Zap,
  LineChart,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Section, SectionHeader } from './section'

interface Feature {
  title: string
  description: string
  icon: ComponentType<{ className?: string }>
  tint: string
}

// Intentionally six — more than that becomes a feature list, less
// feels thin. Copy is benefit-first ("never miss a lead") rather
// than feature-first ("notifications").
const FEATURES: Feature[] = [
  {
    title: 'Shared inbox',
    description:
      'Every WhatsApp conversation in one place. Assign threads, reply as a team, never drop a lead.',
    icon: MessageSquare,
    tint: 'text-blue-400 bg-blue-500/10',
  },
  {
    title: 'Contact hub',
    description:
      'Tags, custom fields, notes, and automatic deduplication. Import existing contacts from CSV.',
    icon: Users,
    tint: 'text-emerald-400 bg-emerald-500/10',
  },
  {
    title: 'Sales pipelines',
    description:
      'Drag deals through stages. See what is won, what is slipping, and where revenue is stuck.',
    icon: GitBranch,
    tint: 'text-violet-400 bg-violet-500/10',
  },
  {
    title: 'Broadcast campaigns',
    description:
      'Send Meta-approved templates to segmented lists. Track delivery, reads, and replies in real time.',
    icon: Radio,
    tint: 'text-amber-400 bg-amber-500/10',
  },
  {
    title: 'No-code automations',
    description:
      'Welcome new contacts, chase unanswered replies, route leads by keyword. Visual flow builder.',
    icon: Zap,
    tint: 'text-rose-400 bg-rose-500/10',
  },
  {
    title: 'Real-time analytics',
    description:
      'Response times, daily volume, pipeline value. See what is working without building dashboards.',
    icon: LineChart,
    tint: 'text-cyan-400 bg-cyan-500/10',
  },
]

export function FeaturesGrid() {
  return (
    <Section id="features">
      <SectionHeader
        eyebrow="Everything you need"
        title="One toolkit for your WhatsApp business"
        description="Stop stitching together an inbox, a spreadsheet, and a broadcast tool. This CRM template for WhatsApp brings them together — and talks to WhatsApp natively."
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => {
          const Icon = f.icon
          return (
            <div
              key={f.title}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 transition-colors hover:border-slate-700 hover:bg-slate-900/70"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${f.tint}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">
                {f.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                {f.description}
              </p>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
