"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { MessageSquare, Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { GithubIcon } from './github-icon'

/**
 * Landing-page top nav. Client component because we need to flip the
 * primary CTA depending on whether the visitor is already signed in.
 * "Auth pending" renders a placeholder (a pair of muted pill shapes)
 * so the CTA doesn't pop in jarringly after hydration.
 */
type AuthState = 'pending' | 'signed-in' | 'signed-out'

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#self-host', label: 'Self-host' },
  { href: '/docs', label: 'Docs' },
  { href: '#faq', label: 'FAQ' },
]

const REPO_URL = 'https://github.com/ArnasDon/wacrm'

export function LandingNav() {
  const [auth, setAuth] = useState<AuthState>('pending')
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    // Quick auth check — no realtime needed, just the initial state.
    const supabase = createClient()
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setAuth(data.session?.user ? 'signed-in' : 'signed-out')
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full border-b transition-colors',
        scrolled
          ? 'border-slate-800 bg-slate-950/80 backdrop-blur'
          : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2"
          aria-label="CRM Template for WhatsApp home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
            <MessageSquare className="h-4 w-4 text-white" />
          </span>
          <span className="text-sm font-semibold text-white">
            CRM Template for WhatsApp
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-slate-300 transition-colors hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <GithubIcon className="h-4 w-4" />
          </a>
          <NavCtas auth={auth} />
        </div>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-800 hover:text-white md:hidden"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-800 bg-slate-950/95 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-4">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <GithubIcon className="h-4 w-4" />
              GitHub
            </a>
            <div className="mt-2 flex flex-col gap-2 border-t border-slate-800 pt-3">
              <NavCtas auth={auth} mobile />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

function NavCtas({ auth, mobile = false }: { auth: AuthState; mobile?: boolean }) {
  const btnBase =
    'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors'
  const secondary = cn(
    btnBase,
    'text-slate-300 hover:bg-slate-800 hover:text-white',
    mobile && 'justify-center',
  )
  const primary = cn(
    btnBase,
    'bg-emerald-500 text-white hover:bg-emerald-400',
    mobile && 'justify-center',
  )

  if (auth === 'pending') {
    // Neutral placeholder that matches the eventual button sizes so
    // nothing shifts once auth resolves.
    return (
      <>
        <span className={cn(btnBase, 'w-20 bg-slate-800/60 text-transparent')}>·</span>
        <span
          className={cn(btnBase, 'w-28 bg-slate-800/60 text-transparent')}
        >
          ·
        </span>
      </>
    )
  }

  if (auth === 'signed-in') {
    return (
      <Link href="/dashboard" className={primary}>
        Go to Dashboard
      </Link>
    )
  }

  return (
    <>
      <Link href="/login" className={secondary}>
        Sign in
      </Link>
      <Link href="/signup" className={primary}>
        Get started
      </Link>
    </>
  )
}
