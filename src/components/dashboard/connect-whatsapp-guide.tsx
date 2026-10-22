'use client'

import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

import { useAuth } from '@/hooks/use-auth'
import { docHref } from '@/lib/docs/nav'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { DocsButton } from '@/components/ui/docs-button'

// ============================================================
// Dashboard → how to connect the WhatsApp number, shown in place of the
// figures and the Team panel until one is connected: every figure is
// zero before then, and this is the one thing that changes that.
//
// Just the process — four short steps with room to breathe — and the
// way in. What to have ready and the fine print live in the
// Documentation (/docs/connect-whatsapp). Laid out like the Team panel:
// one white panel with a header.
// ============================================================

const STEPS = [
  { title: 'Open Settings → WhatsApp', text: 'Click Connect WhatsApp below.' },
  { title: 'Log in to Facebook', text: 'Sign in and choose your business.' },
  { title: 'Add your number', text: 'Enter it, then the code Meta sends.' },
  { title: 'You’re live', text: 'Instant finishes the setup for you.' },
]

export function ConnectWhatsAppGuide() {
  const { canEditSettings } = useAuth()

  return (
    <section aria-labelledby="connect-heading" className="rounded-xl bg-card">
      <div className="border-b border-border px-5 py-3.5">
        <h2
          id="connect-heading"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
        >
          <MessageCircle className="size-4" />
          Connect your WhatsApp number
        </h2>
      </div>

      <ol className="grid gap-8 px-5 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <span className="flex size-7 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground">
              {i + 1}
            </span>
            <p className="mt-3 text-sm font-medium text-foreground">{step.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4">
        {canEditSettings ? (
          <Link href="/settings/whatsapp" className={cn(buttonVariants({ size: 'lg' }), 'px-4')}>
            Connect WhatsApp
          </Link>
        ) : (
          // Connecting is a settings change: only an admin can.
          <p className="text-sm text-muted-foreground">
            Ask your workspace admin to connect the number.
          </p>
        )}
        <DocsButton href={docHref('connect-whatsapp')} />
      </div>
    </section>
  )
}
