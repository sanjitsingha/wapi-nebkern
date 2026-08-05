import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  Bot,
  CheckCheck,
  Clock,
  FileText,
  GitBranch,
  GripVertical,
  Plus,
  Send,
  Sparkles,
  Tag,
  Workflow,
  Zap,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { SectionHead, Btn } from './ui';
import { AutopilotTeaserLink } from './autopilot';

// ============================================================
// No-code automations — the drag-and-drop flow builder, with the
// WhatsApp chat it produces laid *over* it at a slight offset (the same
// screen-mockup style as the hero). Build the flow on the dashboard;
// the overlapping phone shows exactly what the customer receives.
//
// Both are "mother boxes" (black outline); the phone carries the hero's
// shadow so it reads as sitting on top of the dashboard.
// ============================================================

const PALETTE: { label: string; icon: LucideIcon; solid: string }[] = [
  { label: 'Trigger', icon: Zap, solid: 'sky' },
  { label: 'Condition', icon: GitBranch, solid: 'lemon' },
  { label: 'Send reply', icon: Send, solid: 'grass' },
  { label: 'Add tag', icon: Tag, solid: 'coral' },
  { label: 'AI reply', icon: Bot, solid: 'grape' },
  { label: 'Delay', icon: Clock, solid: 'tangerine' },
];

export function Lp2Automations() {
  return (
    <section id="automations" className="scroll-mt-28 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead
          hue="grape"
          title="Automate the busywork by dragging boxes, not writing code."
          highlight="dragging boxes"
          subtitle="Pick a trigger — a keyword, a new contact, a deal moving stage — then drop in the steps. Build the flow, and the exact chat your customer receives is right there on top of it."
        />

        {/* Overlap composition: dashboard as the base, phone laid over
            its bottom-right at an offset. On mobile they stack. */}
        <div className="relative mx-auto mt-14 max-w-4xl">
          <div className="lg:mr-44 xl:mr-48">
            <FlowCanvas />
          </div>

          <div className="relative z-10 mx-auto mt-6 w-full max-w-[290px] lg:absolute lg:right-0 lg:bottom-8 lg:mt-0">
            <ChatCard />
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4">
          <Btn href="/signup">
            Build your first flow
            <ArrowRight className="size-5" strokeWidth={2.75} />
          </Btn>
          <AutopilotTeaserLink />
        </div>
      </div>
    </section>
  );
}

/* ─── The builder canvas (dashboard) ──────────────────────────────── */

function FlowCanvas() {
  return (
    <div className="overflow-hidden rounded-xl border-2 border-(--lp2-ink) bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-(--lp2-ink)/10 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-(--lp2-grape)">
            <Workflow className="size-4 text-white" strokeWidth={2.75} />
          </span>
          <div>
            <p className="text-sm font-extrabold">Price-enquiry autoflow</p>
            <p className="text-[11px] font-semibold text-(--lp2-ink-soft)">
              Runs automatically · 4 steps
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-(--lp2-mint) px-2.5 py-1 text-[11px] font-extrabold">
          <span className="size-1.5 rounded-full bg-(--lp2-grass)" />
          Live
        </span>
      </div>

      {/* Canvas: palette rail (xl only) + flow, over a dotted grid. The
          flow sits left so the overlapping phone has clear room right. */}
      <div
        className="flex gap-6 p-5 sm:p-6"
        style={{
          backgroundImage:
            'radial-gradient(circle, color-mix(in oklab, var(--lp2-ink) 12%, transparent) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        <div className="hidden w-40 shrink-0 xl:block">
          <p className="text-[10px] font-extrabold tracking-wide text-(--lp2-ink-soft) uppercase">
            Blocks
          </p>
          <div className="mt-3 space-y-2">
            {PALETTE.map((b) => (
              <div
                key={b.label}
                className="flex items-center gap-2 rounded-lg bg-white/80 px-2.5 py-2 text-xs font-bold backdrop-blur-sm"
              >
                <GripVertical className="size-3.5 shrink-0 text-(--lp2-ink)/30" />
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: `var(--lp2-${b.solid})` }}
                >
                  <b.icon
                    className={cn(
                      'size-3',
                      b.solid === 'grass' || b.solid === 'grape'
                        ? 'text-white'
                        : '',
                    )}
                    strokeWidth={3}
                  />
                </span>
                {b.label}
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-w-sm lg:max-w-xs xl:max-w-sm">
          <FlowNode
            kind="Trigger"
            title={'Message says “price” or “cost”'}
            icon={Zap}
            tone="sky-soft"
            solid="sky"
          />
          <Connector />
          <FlowNode
            kind="Condition"
            title="Is this a new customer?"
            icon={GitBranch}
            tone="lemon-soft"
            solid="lemon"
          />
          <Connector label="if yes" />
          <FlowNode
            kind="Action"
            title="Reply with the price list & catalogue"
            icon={Send}
            tone="mint"
            solid="grass"
            solidWhite
          />
          <Connector />
          <FlowNode
            kind="Action"
            title={'Tag “Hot lead” & assign to Sales'}
            icon={Tag}
            tone="grape-soft"
            solid="grape"
            solidWhite
          />
        </div>
      </div>
    </div>
  );
}

function FlowNode({
  kind,
  title,
  icon: Icon,
  tone,
  solid,
  solidWhite = false,
}: {
  kind: string;
  title: string;
  icon: LucideIcon;
  tone: string;
  solid: string;
  solidWhite?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl p-3"
      style={{ backgroundColor: `var(--lp2-${tone})` }}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `var(--lp2-${solid})` }}
      >
        <Icon
          className={cn('size-4.5', solidWhite && 'text-white')}
          strokeWidth={2.75}
        />
      </span>
      <div className="min-w-0">
        <span className="block text-[10px] font-extrabold tracking-wide text-(--lp2-ink-soft) uppercase">
          {kind}
        </span>
        <span className="block text-sm font-bold text-balance">{title}</span>
      </div>
    </div>
  );
}

function Connector({ label }: { label?: string }) {
  return (
    <div aria-hidden className="relative flex h-8 items-center justify-center">
      <span className="h-full w-0.5 bg-(--lp2-ink)/15" />
      <span className="absolute top-1/2 left-1/2 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-(--lp2-mint)">
        <Plus className="size-3" strokeWidth={3} />
      </span>
      {label && (
        <span className="absolute left-1/2 ml-4 rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-(--lp2-ink-soft)">
          {label}
        </span>
      )}
    </div>
  );
}

/* ─── The chat screen (hero-style mockup) ─────────────────────────── */

function ChatCard() {
  return (
    <div className="overflow-hidden border-2 border-(--lp2-ink) bg-white shadow-(--lp2-shadow-lg)">
      {/* Header */}
      <div className="flex items-center gap-3 border-b-2 border-(--lp2-ink) bg-(--lp2-mint) px-4 py-3">
        <span className="flex size-10 items-center justify-center rounded-full border-2 border-(--lp2-ink) bg-(--lp2-tangerine) text-xs font-extrabold">
          NS
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">Nova Store</p>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-(--lp2-ink-soft)">
            <span className="size-2 rounded-full bg-(--lp2-grass)" />
            online
          </p>
        </div>
        <span className="rounded-full border-2 border-(--lp2-ink) bg-white px-2.5 py-1 text-[10px] font-extrabold tracking-wide uppercase">
          WhatsApp
        </span>
      </div>

      {/* Thread */}
      <div className="space-y-2.5 bg-(--lp2-cream) px-4 py-4">
        <Bubble side="in">
          Hi! What&apos;s the <b className="font-extrabold">price</b> of the
          linen shirt? 👕
        </Bubble>

        <Bubble side="out" ai>
          Hey! 👋 Here&apos;s our latest price list &amp; catalogue.
        </Bubble>

        {/* Document card the "send reply" action attached. */}
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md border-2 border-(--lp2-ink) bg-(--lp2-mint) p-1.5 shadow-[2px_2px_0_var(--lp2-ink)]">
          <div className="flex items-center gap-2 rounded-lg bg-white/70 p-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-(--lp2-coral)">
              <FileText className="size-4 text-white" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-extrabold">
                Price-list-2026.pdf
              </p>
              <p className="text-[9px] font-semibold text-(--lp2-ink-soft)">
                PDF · 4 pages
              </p>
            </div>
          </div>
          <p className="mt-1 flex items-center justify-end gap-0.5 pr-0.5 text-[9px] font-bold text-(--lp2-ink-soft)">
            22:47
            <CheckCheck className="size-3 text-(--lp2-sky)" strokeWidth={3} />
          </p>
        </div>

        {/* System note — the tag + assign actions. */}
        <p className="mx-auto w-fit rounded-md bg-white px-2.5 py-1 text-center text-[10px] font-bold text-(--lp2-ink-soft)">
          🏷️ Tagged “Hot lead” · assigned to Sales
        </p>
      </div>

      {/* Composer */}
      <div className="flex items-center gap-2 border-t-2 border-(--lp2-ink) bg-white px-3.5 py-2.5">
        <div className="flex-1 rounded-full border-2 border-(--lp2-ink)/15 bg-(--lp2-cream) px-3.5 py-2 text-[13px] font-medium text-(--lp2-ink-soft)">
          Type a message…
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-(--lp2-ink) bg-(--lp2-grass)">
          <ArrowRight className="size-4 text-white" strokeWidth={3} />
        </span>
      </div>
    </div>
  );
}

function Bubble({
  side,
  ai = false,
  children,
}: {
  side: 'in' | 'out';
  ai?: boolean;
  children: React.ReactNode;
}) {
  const out = side === 'out';
  return (
    <div className={cn('flex', out ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl border-2 border-(--lp2-ink) px-3 py-2 text-[13px] font-medium shadow-[2px_2px_0_var(--lp2-ink)]',
          out ? 'rounded-br-md bg-(--lp2-mint)' : 'rounded-bl-md bg-white',
        )}
      >
        {ai && (
          <span className="mb-1.5 inline-flex items-center gap-1 rounded-full border-2 border-(--lp2-ink) bg-(--lp2-lemon) px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase">
            <Sparkles className="size-2.5" strokeWidth={3} />
            Auto-reply
          </span>
        )}
        <p className="leading-snug">{children}</p>
        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] font-bold text-(--lp2-ink-soft)">
          22:47
          {out && <CheckCheck className="size-3 text-(--lp2-sky)" strokeWidth={3} />}
        </p>
      </div>
    </div>
  );
}
