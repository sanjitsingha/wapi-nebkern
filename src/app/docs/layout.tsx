import type { Metadata } from 'next'
import { DocsShell } from '@/components/docs/shell'
import { listDocs } from '@/lib/docs/content'

export const metadata: Metadata = {
  title: {
    template: '%s — CRM Template for WhatsApp Docs',
    default: 'CRM Template for WhatsApp Docs',
  },
  description:
    'Setup, configuration, and deployment docs for the CRM Template for WhatsApp.',
}

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pages = await listDocs()
  return <DocsShell pages={pages}>{children}</DocsShell>
}
