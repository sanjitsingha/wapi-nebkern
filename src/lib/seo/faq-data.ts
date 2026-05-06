/**
 * FAQ content used by both the rendered FAQ accordion on the landing
 * page AND the FAQPage JSON-LD emitted for rich-result eligibility
 * on search engines. Single source so they never drift.
 */
export interface FaqItem {
  q: string
  a: string
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Do I need my own WhatsApp Business API access?',
    a: 'Yes. This CRM template for WhatsApp plugs into your existing Meta WhatsApp Business setup — you bring the phone number and access token, we provide the CRM tooling around it. Any Meta-approved BSP (Business Solution Provider) works.',
  },
  {
    q: 'Can my whole team share one WhatsApp number?',
    a: 'Yes. Assign conversations to specific agents, track who is responding to what, and hand off threads without losing context. All your agents work from a single shared inbox.',
  },
  {
    q: 'How fast is setup?',
    a: 'Most teams are live in under 30 minutes once their WhatsApp Business number has been approved by Meta. Paste your credentials in Settings, import contacts if you have them, and start replying.',
  },
  {
    q: 'Who owns the data?',
    a: 'You do. Everything lives in your own Supabase project — contacts, conversations, deals, automation logs. Export it anytime; there is no lock-in on the data layer.',
  },
  {
    q: 'Can I send bulk messages and automated replies?',
    a: 'Yes. Broadcasts send Meta-approved templates to segmented contact lists with delivery tracking. Automations run no-code flows triggered by new contacts, keywords, tag changes, and more.',
  },
  {
    q: 'What about message templates?',
    a: 'Templates you create in Meta are synced automatically. Use them from the inbox, broadcasts, or inside an automation step.',
  },
]
