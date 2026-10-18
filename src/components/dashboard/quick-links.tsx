import Link from 'next/link'
import {
  ArrowUpRight,
  BookOpen,
  Blocks,
  CirclePlay,
  LayoutTemplate,
  Megaphone,
  Sparkles,
  Webhook,
  Workflow,
} from 'lucide-react'
import type { ComponentType } from 'react'

import { docHref } from '@/lib/docs/nav'

// ============================================================
// Quick links — the foot of the dashboard. One entry per part of the
// product someone sets up once and then forgets where it lives: the
// title opens it in the app, Docs opens its guide in a new tab.
//
// "Watch tutorial" renders only for an entry with a `tutorial` URL, so
// adding a video is a one-line change here — no greyed-out buttons
// promising videos that don't exist yet.
// ============================================================

interface QuickLink {
  title: string
  description: string
  icon: ComponentType<{ className?: string }>
  /** In-app page the title opens. */
  href: string
  /** Docs slug — see lib/docs/nav.ts. */
  doc: string
  /** A video walkthrough, once there is one. */
  tutorial?: string
}

const LINKS: QuickLink[] = [
  {
    title: 'Bulk messages',
    description: 'Send or schedule template campaigns to your contacts',
    icon: Megaphone,
    href: '/campaigns',
    doc: 'campaigns',
  },
  {
    title: 'Message templates',
    description: 'Create templates and submit them for Meta approval',
    icon: LayoutTemplate,
    href: '/templates',
    doc: 'templates',
  },
  {
    title: 'Automations & flows',
    description: 'Auto-reply, follow up and route chats without lifting a finger',
    icon: Workflow,
    href: '/automations',
    doc: 'automations',
  },
  {
    title: 'Maya, your AI agent',
    description: 'Let AI answer customers and hand over to your team when needed',
    icon: Sparkles,
    href: '/askmaya',
    doc: 'ai-agents',
  },
  {
    title: 'Integrate your tools',
    description: 'Link HubSpot, Zoho CRM, Shopify, WooCommerce and Google Sheets',
    icon: Blocks,
    href: '/settings/integrations',
    doc: 'api-and-integrations',
  },
  {
    title: 'APIs & webhooks',
    description: 'Build custom automations with the Instant API and webhooks',
    icon: Webhook,
    href: '/settings/api-access',
    doc: 'api-and-integrations',
  },
]

const chip =
  'inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted'

export function QuickLinks() {
  return (
    <section aria-labelledby="quick-links-heading" className="pt-2">
      <div className="flex items-center gap-3">
        <h2 id="quick-links-heading" className="shrink-0 text-sm text-muted-foreground">
          Quick links
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      <ul className="mt-5 grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => (
          <li key={l.title}>
            <Link
              href={l.href}
              className="group inline-flex items-center gap-2 text-sm font-semibold text-foreground"
            >
              <l.icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="group-hover:underline">{l.title}</span>
              <ArrowUpRight className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">{l.description}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <a href={docHref(l.doc)} target="_blank" rel="noopener noreferrer" className={chip}>
                <BookOpen className="size-3.5" />
                Docs
              </a>
              {l.tutorial && (
                <a href={l.tutorial} target="_blank" rel="noopener noreferrer" className={chip}>
                  <CirclePlay className="size-3.5 text-red-600" />
                  Watch tutorial
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
