'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Plus } from 'lucide-react';

import { track } from '@/lib/marketing/track';
import { FAQS } from '@/lib/marketing/pricing-data';

// ============================================================
// The two client-side analytics touchpoints on /pricing that need a
// browser API: firing an event when the comparison table scrolls into
// view, and one per FAQ a visitor opens. Everything else on the page is
// static server HTML.
// ============================================================

/** Fires `event` once, the first time its children enter the viewport. */
export function TrackInView({
  event,
  children,
}: {
  event: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || fired.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !fired.current) {
          fired.current = true;
          track(event);
          obs.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [event]);

  return <div ref={ref}>{children}</div>;
}

/** The billing FAQ accordion. Client so each open fires faq_expanded. */
export function PricingFaqList() {
  // Colour dots cycle through the palette so the list isn't a grey wall.
  const hues = ['pop', 'lemon', 'coral', 'sky', 'grape', 'tangerine'];
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {FAQS.map((f, i) => (
        <details
          key={f.id}
          open={open === f.id}
          onToggle={(e) => {
            const isOpen = (e.currentTarget as HTMLDetailsElement).open;
            if (isOpen) {
              setOpen(f.id);
              track('faq_expanded', { question_id: f.id });
            } else if (open === f.id) {
              setOpen(null);
            }
          }}
          className="group rounded-xl border-2 border-(--lp2-ink) bg-white"
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-base font-bold [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden
              className="size-3.5 shrink-0 rounded-full"
              style={
                { backgroundColor: `var(--lp2-${hues[i % hues.length]})` } as CSSProperties
              }
            />
            <span className="flex-1 text-pretty">{f.q}</span>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--lp2-cream) transition-transform duration-200 group-open:rotate-45">
              <Plus className="size-4" strokeWidth={3} />
            </span>
          </summary>
          <p className="border-t border-(--lp2-ink)/10 px-5 py-4 text-lg leading-relaxed text-(--lp2-ink-soft)">
            {f.a}
          </p>
        </details>
      ))}
    </div>
  );
}
