import { cn } from '@/lib/utils';
import type { Lp2Hue } from './decor';
import { SectionHead } from './ui';
import {
  MiniCampaign,
  MiniFlow,
  MiniInbox,
  MiniKanban,
} from './features-visuals';

// ============================================================
// Features — a bento of four cards, each a different hue, each showing
// a scrap of the actual product rather than an icon.
//
// Shares its treatment with `ai-performance`: white section, each card
// bordered in its own hue with a gradient wash rising from the bottom,
// and no ink outline or offset shadow anywhere. The two sections sit
// two apart on the page, so a card that is outlined in one and washed
// in the other reads as two different products.
// ============================================================

/**
 * The wash on the visual half, rising from the bottom edge — the same
 * move `ai-performance` makes, so the two sections read as one system.
 * The copy half stays plain white: a gradient behind body text is the
 * one place it costs something, and the split is what gives the bento
 * its shape.
 *
 * It stops at a light tint rather than running to white, because the
 * mini product visuals are built from white tiles and would disappear
 * against a white top.
 */
const panelWash = (hue: Lp2Hue) =>
  `linear-gradient(to top, color-mix(in oklab, var(--lp2-${hue}) 26%, #fff), color-mix(in oklab, var(--lp2-${hue}) 11%, #fff))`;

export function Lp2Features() {
  return (
    <section id="features" className="scroll-mt-28 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead
          hue="sky"
          title="Four apps' worth of tools, one happy inbox."
          highlight="one happy inbox"
          highlightText="white"
          subtitle="Inbox, campaigns, CRM and automations usually live in four different tabs with four different bills. Here they're one product, on the official WhatsApp Business API."
        />

        {/* Six-column bento: wide cards take four, narrow take two, so
            the two rows mirror each other 4–2 / 2–4. Order matters —
            keep a wide card at each end or the rhythm collapses. */}
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
          {/* Saturated hues, not the `-soft` pastels: the wash is mixed
              from the hue here, so a pastel would mix to almost nothing
              and the border would be too faint to define the card. */}
          <Card
            hue="grass"
            wide
            title="Shared team inbox"
            body="Every WhatsApp, Instagram and Messenger chat in one place. Assign owners, leave internal notes, and never answer the same question twice."
            visual={<MiniInbox />}
          />
          <Card
            hue="lemon"
            title="Broadcast campaigns"
            body="Send approved templates to thousands and watch delivery, reads and replies climb live."
            visual={<MiniCampaign />}
          />
          <Card
            hue="coral"
            title="Pipelines & CRM"
            body="Custom fields, tags and drag-and-drop stages — a real CRM wrapped around your chats."
            visual={<MiniKanban />}
          />
          <Card
            hue="grape"
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
  /** A saturated lp2 hue. Both the border and the wash derive from it,
   *  so the card only ever carries one colour. */
  hue: Lp2Hue;
  title: string;
  body: string;
  visual: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        // A 1px border in a softened version of the card's own hue, and
        // no offset shadow. A 2px saturated outline fought the gradient
        // it was wrapping — the wash is doing the work now, so the edge
        // only has to close the shape. No padding either, so the washed
        // visual half runs to the card edge; overflow-hidden keeps it
        // inside the radius.
        'group overflow-hidden rounded-xl border bg-white transition-transform duration-200 hover:-translate-y-1',
        // Wide cards go full-bleed on the two-column tablet grid too —
        // a 4-col card squeezed into half a tablet row leaves its
        // side-by-side split too narrow to read.
        wide ? 'sm:col-span-2 lg:col-span-4' : 'lg:col-span-2'
      )}
      style={{
        borderColor: `color-mix(in oklab, var(--lp2-${hue}) 55%, #fff)`,
      }}
    >
      <div className={cn(wide && 'grid h-full sm:grid-cols-2')}>
        {wide && <Text title={title} body={body} />}

        {/* Visual half — defined by its wash, no divider rule. */}
        <div
          className="grid items-center p-6"
          style={{ backgroundImage: panelWash(hue) }}
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
