'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  ChatBubble,
  CheckItem,
  FieldsCard,
  MiniCampaign,
  MiniFlow,
  MiniInbox,
  MiniKanban,
  PhoneFrame,
  QuickReplies,
} from './landing-visuals';

// ============================================================
// Interactive tabbed sections for the landing page. Kept in a
// client component so the rest of the page stays server-rendered.
// ============================================================

function TabBar({
  tabs,
  active,
  onSelect,
  className,
}: {
  tabs: readonly string[];
  active: number;
  onSelect: (i: number) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'scrollbar-none border-border -mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:justify-center sm:px-0',
        className,
      )}
    >
      {tabs.map((t, i) => (
        <button
          key={t}
          role="tab"
          aria-selected={i === active}
          onClick={() => onSelect(i)}
          className={cn(
            '-mb-px shrink-0 border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors',
            i === active
              ? 'border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground border-transparent',
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/* ─── Customer journey: Capture → Qualify → Nurture → Convert → Retain ── */

const JOURNEY = [
  {
    tab: 'Capture',
    title: 'Turn every hello into a contact you own',
    body: 'Every incoming message becomes a contact with full history — no lead left sitting in a personal phone. Import your existing base and keep growing it on autopilot.',
    points: [
      'Contacts created automatically from incoming chats',
      'Bulk import via CSV with custom fields and tags',
      'Instagram DMs land in the same inbox',
    ],
    visual: (
      <PhoneFrame title="Nova Store">
        <ChatBubble side="in" time="10:02">
          Hi! Saw your ad — do you deliver to Pune? 🙋
        </ChatBubble>
        <ChatBubble side="out" time="10:02" ai>
          We do! Delivery takes 2–3 days. Want me to send today&apos;s catalog?
        </ChatBubble>
        <QuickReplies options={['Yes, send it', 'Talk to an agent']} />
      </PhoneFrame>
    ),
  },
  {
    tab: 'Qualify',
    title: 'Let AI ask the questions and fill your CRM',
    body: 'Your AI agent greets every lead, asks qualifying questions, and writes the answers into contact fields and tags — so your team only spends time on leads that matter.',
    points: [
      'AI agent trained on your own knowledge base',
      'Answers captured into custom fields automatically',
      'Hot leads tagged and routed to the right teammate',
    ],
    visual: (
      <div className="relative w-full max-w-sm">
        <PhoneFrame title="Nova Store">
          <ChatBubble side="out" time="10:04" ai>
            Great! What budget range should I show you? 💸
          </ChatBubble>
          <ChatBubble side="in" time="10:05">
            Around 40–50k, need it this week
          </ChatBubble>
          <ChatBubble side="out" time="10:05" ai>
            Perfect — sharing 6 options in that range now.
          </ChatBubble>
        </PhoneFrame>
        <FieldsCard className="absolute -right-4 -bottom-6 w-44 sm:-right-10" />
      </div>
    ),
  },
  {
    tab: 'Nurture',
    title: 'Broadcasts that feel personal, at any scale',
    body: 'Segment your audience with tags, lists, and custom fields, then send Meta-approved template campaigns — and watch delivery, read, and reply rates live.',
    points: [
      'Target campaigns with lists, tags, and segments',
      'Meta-approved templates managed inside the app',
      'Live delivery, read, and reply analytics per campaign',
    ],
    visual: (
      <div className="w-full max-w-sm space-y-3">
        <MiniCampaign />
        <MiniInbox />
      </div>
    ),
  },
  {
    tab: 'Convert',
    title: 'A sales pipeline that lives where the deal happens',
    body: 'Drag deals through your own stages while the conversation stays one click away. Assign owners, set values, and never lose track of who is closing what.',
    points: [
      'Kanban pipelines with your own custom stages',
      'Deals linked to the live WhatsApp conversation',
      'Assignments so every deal has one clear owner',
    ],
    visual: (
      <div className="w-full max-w-sm space-y-3">
        <MiniKanban />
        <MiniInbox />
      </div>
    ),
  },
  {
    tab: 'Retain',
    title: 'Follow-ups and support that run themselves',
    body: 'Automations trigger on tags, replies, and deal stages to send the right message at the right moment — while support tickets keep every issue on record.',
    points: [
      'No-code flows with triggers, conditions, and actions',
      'Automatic follow-ups on tags and deal-stage changes',
      'Built-in support tickets with team-wide visibility',
    ],
    visual: (
      <div className="w-full max-w-sm space-y-3">
        <MiniFlow />
        <MiniCampaign />
      </div>
    ),
  },
] as const;

export function JourneyTabs() {
  const [active, setActive] = useState(0);
  const item = JOURNEY[active];

  return (
    <div>
      <TabBar
        tabs={JOURNEY.map((j) => j.tab)}
        active={active}
        onSelect={setActive}
        className="mt-12"
      />

      <div className="mt-12 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-primary text-sm font-semibold">
            Step {active + 1} · {item.tab}
          </p>
          <h3 className="mt-3 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            {item.title}
          </h3>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed">
            {item.body}
          </p>
          <ul className="mt-6 space-y-3">
            {item.points.map((p) => (
              <CheckItem key={p}>{p}</CheckItem>
            ))}
          </ul>
          <Link
            href="/signup"
            className="text-primary mt-7 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
          >
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="relative flex justify-center pb-8 lg:pb-0">
          <div
            aria-hidden
            className="bg-primary/10 pointer-events-none absolute inset-x-8 top-6 bottom-0 -z-10 rounded-[2.5rem] blur-2xl"
          />
          {item.visual}
        </div>
      </div>
    </div>
  );
}

/* ─── Use cases by team: Sales / Marketing / Support ──────────────── */

const TEAMS = [
  {
    tab: 'Sales',
    audience: 'For founders, sales reps & closers',
    title: 'Close deals without leaving the conversation',
    body: 'Qualify with AI, track every deal on a pipeline, and reply from a shared inbox where the whole history is one scroll away.',
    tags: ['Pipelines & deals', 'AI lead qualification', 'Chat assignments', 'Internal notes', 'Contact history'],
    visual: (
      <div className="w-full max-w-sm space-y-3">
        <MiniKanban />
        <MiniInbox />
      </div>
    ),
  },
  {
    tab: 'Marketing',
    audience: 'For growth & campaign managers',
    title: 'Campaigns with open rates email can only dream of',
    body: 'Build segments from real conversation data, launch template broadcasts in minutes, and measure every send down to the reply.',
    tags: ['Broadcast campaigns', 'Segments & lists', 'Template manager', 'Campaign analytics', 'Zapier / Make / n8n'],
    visual: (
      <div className="w-full max-w-sm space-y-3">
        <MiniCampaign />
        <MiniFlow />
      </div>
    ),
  },
  {
    tab: 'Support',
    audience: 'For support teams & operations',
    title: 'Answer instantly, escalate gracefully',
    body: 'Let the AI agent resolve routine questions from your knowledge base and hand the tricky ones to a human — with tickets keeping every issue accountable.',
    tags: ['AI auto-replies', 'Human handoff', 'Support tickets', '24-hour window tracking', 'Team notes'],
    visual: (
      <div className="w-full max-w-sm">
        <PhoneFrame title="Nova Store" subtitle="AI agent · online">
          <ChatBubble side="in" time="18:21">
            Can I return an item after 15 days?
          </ChatBubble>
          <ChatBubble side="out" time="18:21" ai>
            Returns are free within 30 days as long as the tags are on. Want me
            to start a return for you?
          </ChatBubble>
          <ChatBubble side="in" time="18:22">
            It&apos;s a custom order actually
          </ChatBubble>
          <ChatBubble side="out" time="18:22">
            Looping in Priya from our team — she&apos;ll sort this out for you
            right away. 👋
          </ChatBubble>
        </PhoneFrame>
      </div>
    ),
  },
] as const;

export function TeamTabs() {
  const [active, setActive] = useState(0);
  const item = TEAMS[active];

  return (
    <div>
      <TabBar
        tabs={TEAMS.map((t) => t.tab)}
        active={active}
        onSelect={setActive}
        className="mt-12"
      />

      <div className="mt-12 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-primary text-sm font-semibold">{item.audience}</p>
          <h3 className="mt-3 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            {item.title}
          </h3>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed">
            {item.body}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {item.tags.map((t) => (
              <span
                key={t}
                className="border-border text-foreground rounded-full border bg-card px-3.5 py-1.5 text-xs font-medium"
              >
                {t}
              </span>
            ))}
          </div>
          <Link
            href="/signup"
            className="text-primary mt-7 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
          >
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="relative flex justify-center">
          <div
            aria-hidden
            className="bg-primary/10 pointer-events-none absolute inset-x-8 top-6 bottom-0 -z-10 rounded-[2.5rem] blur-2xl"
          />
          {item.visual}
        </div>
      </div>
    </div>
  );
}
