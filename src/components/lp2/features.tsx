import { CheckCheck, GripVertical, Sparkles, Zap } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Lp2Hue } from './decor';
import { SectionHead } from './ui';

// ============================================================
// Features — a bento of four cards, each a different hue, each showing
// a scrap of the actual product rather than an icon.
//
// Flat treatment: plain white section, cards defined by a faint hairline
// (no ink outline, no shadow), inner graphics carried by fill colour
// alone, and gentle corners rather than the earlier heavy curves.
// ============================================================

export function Lp2Features() {
  return (
    <section id="features" className="scroll-mt-28 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead
          hue="sky"
          title="Four apps' worth of tools, one happy inbox."
          highlight="one happy inbox"
          subtitle="Inbox, campaigns, CRM and automations usually live in four different tabs with four different bills. Here they're one product, on the official WhatsApp Business API."
        />

        {/* Six-column bento: wide cards take four, narrow take two, so
            the two rows mirror each other 4–2 / 2–4. Order matters —
            keep a wide card at each end or the rhythm collapses. */}
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
          <Card
            hue="mint"
            wide
            title="Shared team inbox"
            body="Every WhatsApp, Instagram and Messenger chat in one place. Assign owners, leave internal notes, and never answer the same question twice."
            visual={<MiniInbox />}
          />
          <Card
            hue="lemon-soft"
            title="Broadcast campaigns"
            body="Send approved templates to thousands and watch delivery, reads and replies climb live."
            visual={<MiniCampaign />}
          />
          <Card
            hue="coral-soft"
            title="Pipelines & CRM"
            body="Custom fields, tags and drag-and-drop stages — a real CRM wrapped around your chats."
            visual={<MiniKanban />}
          />
          <Card
            hue="grape-soft"
            wide
            title="Flows & automations"
            body="No-code triggers, conditions and actions that greet, route and follow up at 3am without waking anyone."
            visual={<MiniFlow />}
          />
        </div>
      </div>
    </section>
  );
}

/* ─── Card shell ──────────────────────────────────────────────────── */

function Card({
  hue,
  title,
  body,
  visual,
  wide = false,
}: {
  /** Any lp2 hue token name, including the `-soft` washes — these are
   *  large fills sitting behind ink text, so the pastels are usually
   *  the right call. */
  hue: Lp2Hue | `${Lp2Hue}-soft`;
  title: string;
  body: string;
  visual: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        // The card (mother box) keeps its black ink outline; only the
        // graphics *inside* the visual half go borderless. No padding so
        // the tinted visual half runs to the card edge, with
        // overflow-hidden respecting the (gentler) corner radius.
        'group overflow-hidden rounded-xl border-2 border-(--lp2-ink) bg-white transition-transform duration-200 hover:-translate-y-1',
        // Wide cards go full-bleed on the two-column tablet grid too —
        // a 4-col card squeezed into half a tablet row leaves its
        // side-by-side split too narrow to read.
        wide ? 'sm:col-span-2 lg:col-span-4' : 'lg:col-span-2',
      )}
    >
      <div className={cn(wide && 'grid h-full sm:grid-cols-2')}>
        {wide && <Text title={title} body={body} />}

        {/* Visual half — defined by its fill, no divider rule. */}
        <div
          className="grid items-center p-6"
          style={{ backgroundColor: `var(--lp2-${hue})` }}
        >
          {visual}
        </div>

        {!wide && <Text title={title} body={body} />}
      </div>
    </div>
  );
}

function Text({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col justify-center p-6 sm:p-7">
      <h3 className="lp2-display text-2xl font-extrabold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-(--lp2-ink-soft)">
        {body}
      </p>
    </div>
  );
}

/* ─── Mini product visuals ────────────────────────────────────────── */

// White tiles, no outline — the contrast against each card's coloured
// half is what separates them.
const chip = 'rounded-lg bg-white';

function MiniInbox() {
  const rows = [
    { initials: 'AR', hue: 'coral', width: 'w-24', unread: 2 },
    { initials: 'MK', hue: 'sky', width: 'w-20', unread: 0 },
    { initials: 'JD', hue: 'lemon', width: 'w-28', unread: 5 },
  ] as const;

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.initials} className={cn(chip, 'flex items-center gap-2.5 p-2.5')}>
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
            style={{ backgroundColor: `var(--lp2-${r.hue})` }}
          >
            {r.initials}
          </span>
          <span className="flex-1 space-y-1.5">
            <span className={cn('block h-2 rounded-full bg-(--lp2-ink)/70', r.width)} />
            <span className="block h-2 w-16 rounded-full bg-(--lp2-ink)/20" />
          </span>
          {r.unread > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-(--lp2-grass) text-[9px] font-extrabold text-white">
              {r.unread}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function MiniCampaign() {
  // Heights, not data — a delivery funnel that steps down convincingly.
  const bars = [
    { label: 'Sent', h: 'h-16', hue: 'grass' },
    { label: 'Read', h: 'h-12', hue: 'sky' },
    { label: 'Reply', h: 'h-8', hue: 'coral' },
  ] as const;

  return (
    <div className={cn(chip, 'p-3')}>
      <div className="flex items-end justify-center gap-3">
        {bars.map((b) => (
          <span key={b.label} className="flex flex-col items-center gap-1.5">
            <span
              className={cn('w-8 rounded-md', b.h)}
              style={{ backgroundColor: `var(--lp2-${b.hue})` }}
            />
            <span className="text-[9px] font-bold text-(--lp2-ink-soft)">
              {b.label}
            </span>
          </span>
        ))}
      </div>
      <p className="mt-2 flex items-center justify-center gap-1 border-t border-(--lp2-ink)/10 pt-2 text-[10px] font-extrabold">
        <CheckCheck className="size-3 text-(--lp2-sky)" strokeWidth={3} />
        4,182 delivered
      </p>
    </div>
  );
}

function MiniKanban() {
  const cols = [
    { name: 'New', hue: 'lemon', cards: 2 },
    { name: 'Won', hue: 'grass', cards: 1 },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2">
      {cols.map((c) => (
        <div key={c.name} className={cn(chip, 'space-y-1.5 p-2')}>
          <span
            className="block rounded-md px-1.5 py-0.5 text-[9px] font-extrabold"
            style={{ backgroundColor: `var(--lp2-${c.hue})` }}
          >
            {c.name}
          </span>
          {Array.from({ length: c.cards }).map((_, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded-md bg-(--lp2-cream) p-1.5"
            >
              <GripVertical className="size-3 shrink-0 text-(--lp2-ink)/30" />
              <span className="h-1.5 flex-1 rounded-full bg-(--lp2-ink)/25" />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function MiniFlow() {
  const nodes = [
    { label: 'Message in', hue: 'sky', icon: Sparkles },
    { label: 'AI replies', hue: 'lemon', icon: Zap },
    { label: 'Deal created', hue: 'grass', icon: CheckCheck },
  ] as const;

  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2">
      {nodes.map((n, i) => (
        <span key={n.label} className="flex items-center gap-1.5 sm:gap-2">
          <span
            className={cn(chip, 'flex flex-col items-center gap-1 px-2 py-2.5 text-center')}
          >
            <span
              className="flex size-7 items-center justify-center rounded-full"
              style={{ backgroundColor: `var(--lp2-${n.hue})` }}
            >
              <n.icon
                className={cn('size-3.5', n.hue === 'grass' && 'text-white')}
                strokeWidth={3}
              />
            </span>
            <span className="text-[9px] leading-tight font-extrabold">
              {n.label}
            </span>
          </span>

          {/* Connector between nodes, omitted after the last one. */}
          {i < nodes.length - 1 && (
            <span
              aria-hidden
              className="h-0.5 w-3 shrink-0 rounded-full bg-(--lp2-ink)/40 sm:w-4"
            />
          )}
        </span>
      ))}
    </div>
  );
}
