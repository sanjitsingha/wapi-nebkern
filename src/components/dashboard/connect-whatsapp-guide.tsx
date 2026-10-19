'use client'

import Link from 'next/link'
import { CircleCheck, MessageCircle } from 'lucide-react'
import { MdOutlineOpenInNew } from 'react-icons/md'

import { useAuth } from '@/hooks/use-auth'
import { docHref } from '@/lib/docs/nav'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

// ============================================================
// Dashboard → how to connect the WhatsApp number, shown in place of the
// figures and the Team panel until one is connected: every figure is
// zero before then, and this is the one thing that changes that.
//
// What to have ready, then the steps — a short cut of
// /docs/connect-whatsapp, which the "full guide" link opens. Laid out
// like the Team panel: one white panel, a header, then the content.
// ============================================================

const BEFORE_YOU_START = [
  { title: 'A Facebook account', text: 'You sign in with it to give Instant access.' },
  { title: 'A business phone number', text: 'One that can receive a code by SMS or phone call.' },
  {
    title: 'Not active on WhatsApp',
    text: 'A number on the WhatsApp app can’t connect. Delete that account first, or use another number.',
  },
  { title: 'A display name', text: 'The business name customers see. Meta reviews it.' },
]

const STEPS = [
  {
    title: 'Open Settings → WhatsApp',
    text: 'Click Connect WhatsApp below, then I’m ready and Continue with Facebook.',
  },
  {
    title: 'Log in to Facebook',
    text: 'Sign in and pick your Meta Business portfolio, or create one.',
  },
  {
    title: 'Add your number',
    text: 'Choose or create a WhatsApp Business Account, add your number and display name, and enter the code Meta sends.',
  },
  {
    title: 'Instant finishes the setup',
    text: 'When the Facebook window closes, Instant registers the number and shows it as Live.',
  },
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

      <div className="px-5 pt-4">
        <p className="text-sm text-foreground">
          Nothing sends or arrives until your number is connected. It takes a few minutes.
        </p>
      </div>

      <div className="grid gap-6 px-5 py-5 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-border">
        <div className="lg:pr-6">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Before you start
          </h3>
          <ul className="mt-3 space-y-3">
            {BEFORE_YOU_START.map((item) => (
              <li key={item.title} className="flex gap-3">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:pl-6">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Steps
          </h3>
          <ol className="mt-3 space-y-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4">
        {canEditSettings ? (
          <Link href="/settings/whatsapp" className={cn(buttonVariants(), 'h-9 px-4')}>
            Connect WhatsApp
          </Link>
        ) : (
          // Connecting is a settings change: only an admin can.
          <p className="text-sm text-muted-foreground">
            Ask your workspace admin to connect the number.
          </p>
        )}
        <a
          href={docHref('connect-whatsapp')}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: 'outline' }), 'h-9 px-4')}
        >
          Read the full guide
          <MdOutlineOpenInNew className="size-4" />
        </a>
      </div>
    </section>
  )
}
