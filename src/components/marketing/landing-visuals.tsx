import { Check, CheckCheck, Bot, Sparkles, Send, Inbox, Zap } from 'lucide-react';

import { cn } from '@/lib/utils';

// ============================================================
// Presentational mockups for the marketing landing page — chat
// bubbles, a phone frame, floating stat cards, and miniature
// product UIs. All CSS-drawn so the page ships with zero images;
// swap in real screenshots later without touching layout.
// ============================================================

/* ─── Decorative gradient bars (signature motif) ──────────────────── */

const BAR_HEIGHTS = [34, 58, 44, 72, 52, 88, 64];

export function GradientBars({
  className,
  mirrored,
}: {
  className?: string;
  mirrored?: boolean;
}) {
  const heights = mirrored ? [...BAR_HEIGHTS].reverse() : BAR_HEIGHTS;
  return (
    <div
      aria-hidden
      className={cn('flex items-end gap-2', className)}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-4 rounded-full bg-linear-to-t from-primary via-emerald-500 to-emerald-300 opacity-80 sm:w-5"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}

/* ─── WhatsApp-style chat ─────────────────────────────────────────── */

export function ChatBubble({
  side,
  children,
  time,
  ai,
}: {
  side: 'in' | 'out';
  children: React.ReactNode;
  time?: string;
  ai?: boolean;
}) {
  const isOut = side === 'out';
  return (
    <div className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug shadow-sm',
          isOut
            ? 'rounded-br-md bg-primary-soft-2 text-foreground'
            : 'rounded-bl-md bg-card text-foreground border-border/60 border',
        )}
      >
        <div>{children}</div>
        <div
          className={cn(
            'mt-1 flex items-center gap-1 text-[10px]',
            'text-muted-foreground',
            isOut && 'justify-end',
          )}
        >
          {ai && (
            <span className="text-primary inline-flex items-center gap-0.5 font-medium">
              <Sparkles className="h-2.5 w-2.5" /> AI
            </span>
          )}
          {time && <span>{time}</span>}
          {isOut && <CheckCheck className="text-sky-500 h-3 w-3" />}
        </div>
      </div>
    </div>
  );
}

export function QuickReplies({ options }: { options: string[] }) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {options.map((o) => (
        <span
          key={o}
          className="border-primary/40 text-primary rounded-full border bg-card px-3 py-1 text-[11px] font-medium"
        >
          {o}
        </span>
      ))}
    </div>
  );
}

export function PhoneFrame({
  title,
  subtitle = 'online',
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border bg-card w-full max-w-sm overflow-hidden rounded-[2rem] border shadow-2xl',
        className,
      )}
    >
      {/* Chat header */}
      <div className="bg-primary flex items-center gap-3 px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
          {title.charAt(0)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{title}</p>
          <p className="text-[11px] text-emerald-100/90">{subtitle}</p>
        </div>
      </div>
      {/* Message area with a subtle dotted texture, like a chat wallpaper */}
      <div
        className="space-y-2.5 px-3.5 py-4"
        style={{
          backgroundImage: 'radial-gradient(rgba(11,102,35,0.07) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ─── Floating cards around the hero phone ────────────────────────── */

export function FloatCard({
  className,
  children,
  delay,
}: {
  className?: string;
  children: React.ReactNode;
  delay?: string;
}) {
  return (
    <div
      className={cn(
        'border-border/70 animate-floaty absolute rounded-xl border bg-card p-3 shadow-lg',
        className,
      )}
      style={delay ? { animationDelay: delay } : undefined}
    >
      {children}
    </div>
  );
}

/* ─── Extracted-fields card (AI qualification) ────────────────────── */

export function FieldsCard({ className }: { className?: string }) {
  const fields = [
    { k: 'Name', v: 'Rohan M.' },
    { k: 'City', v: 'Pune' },
    { k: 'Budget', v: '₹40–50k' },
    { k: 'Intent', v: 'High' },
  ];
  return (
    <div className={cn('border-border bg-card rounded-xl border p-4 shadow-lg', className)}>
      <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
        <Bot className="text-primary h-3.5 w-3.5" /> Captured by AI
      </p>
      <dl className="mt-2.5 space-y-1.5">
        {fields.map((f) => (
          <div key={f.k} className="flex items-center justify-between gap-4 text-xs">
            <dt className="text-muted-foreground">{f.k}</dt>
            <dd className="text-foreground font-semibold">{f.v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex gap-1.5">
        <span className="bg-primary-soft text-primary rounded-full px-2 py-0.5 text-[10px] font-semibold">
          hot-lead
        </span>
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold">
          catalog-sent
        </span>
      </div>
    </div>
  );
}

/* ─── Miniature product UIs for the platform cards ────────────────── */

export function MiniInbox() {
  const rows = [
    { name: 'Ananya S.', msg: 'Is COD available?', badge: 2, who: 'PK' },
    { name: 'Rahul V.', msg: 'Payment done ✅', badge: 0, who: 'ME' },
    { name: 'Fatima K.', msg: 'Need a size chart…', badge: 1, who: 'AI' },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div
          key={r.name}
          className="border-border/60 flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2"
        >
          <span className="bg-primary-soft text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
            {r.name.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{r.name}</p>
            <p className="text-muted-foreground truncate text-[11px]">{r.msg}</p>
          </div>
          {r.badge > 0 && (
            <span className="bg-primary flex h-4.5 w-4.5 items-center justify-center rounded-full text-[9px] font-bold text-white">
              {r.badge}
            </span>
          )}
          <span className="border-border text-muted-foreground rounded-md border px-1.5 py-0.5 text-[9px] font-semibold">
            {r.who}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MiniCampaign() {
  const stats = [
    { label: 'Sent', value: '12,480', pct: 100 },
    { label: 'Delivered', value: '12,231', pct: 98 },
    { label: 'Read', value: '9,235', pct: 74 },
    { label: 'Replied', value: '2,371', pct: 19 },
  ];
  return (
    <div className="border-border/60 rounded-lg border bg-card p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">Festive Sale · Broadcast</p>
        <span className="bg-primary-soft text-primary rounded-full px-2 py-0.5 text-[10px] font-semibold">
          Completed
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-semibold">{s.value}</span>
            </div>
            <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-linear-to-r from-primary to-emerald-400"
                style={{ width: `${s.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MiniKanban() {
  const cols = [
    {
      title: 'Leads',
      deals: [
        { amount: '₹48k', who: 'Rohan' },
        { amount: '₹22k', who: 'Meera' },
      ],
    },
    { title: 'Demo', deals: [{ amount: '₹1.2L', who: 'Acme' }] },
    {
      title: 'Won',
      deals: [
        { amount: '₹95k', who: 'Kiran' },
        { amount: '₹31k', who: 'Dev' },
      ],
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {cols.map((c) => (
        <div key={c.title} className="border-border/60 rounded-lg border bg-card p-1.5">
          <p className="text-muted-foreground truncate text-[10px] font-semibold tracking-wide uppercase">
            {c.title}
          </p>
          <div className="mt-1.5 space-y-1.5">
            {c.deals.map((d) => (
              <div
                key={d.who}
                className="border-border/60 bg-card-2 rounded-md border px-1.5 py-1.5"
              >
                <p className="truncate text-[10px] font-semibold">{d.amount}</p>
                <p className="text-muted-foreground truncate text-[9px]">{d.who}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MiniFlow() {
  const nodes = [
    { icon: Inbox, label: 'New message received', kind: 'Trigger' },
    { icon: Zap, label: 'Message contains "price"', kind: 'Condition' },
    { icon: Send, label: 'Send price-list template', kind: 'Action' },
  ];
  return (
    <div className="space-y-1">
      {nodes.map((n, i) => (
        <div key={n.label}>
          <div className="border-border/60 flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2">
            <span className="bg-primary-soft text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-md">
              <n.icon className="h-3 w-3" />
            </span>
            <div className="min-w-0">
              <p className="text-muted-foreground text-[9px] font-semibold tracking-wide uppercase">
                {n.kind}
              </p>
              <p className="truncate text-[11px] font-medium">{n.label}</p>
            </div>
          </div>
          {i < nodes.length - 1 && (
            <div className="bg-border mx-auto h-2.5 w-px" />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Small check bullet used across sections ─────────────────────── */

export function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="bg-primary-soft text-primary mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
        <Check className="h-3 w-3" />
      </span>
      <span className="text-foreground text-sm">{children}</span>
    </li>
  );
}

