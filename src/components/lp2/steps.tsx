import { Sparkle } from './decor';
import { SectionHead } from './ui';

// ============================================================
// How it works — three numbered cards.
//
// Sits between the feature bento and the pricing table on purpose:
// that's exactly where a reader who likes the product starts asking
// "…but how much work is this for me?". Three cards is the answer;
// four would undercut it.
//
// Flat treatment: white cards on white, a faint hairline instead of the
// ink outline + shadow, and gentler corners.
// ============================================================

const STEPS = [
  {
    n: '1',
    hue: 'lemon',
    title: 'Connect your number',
    body: 'We are an official Meta Tech Provider, so embedded signup puts you straight onto the WhatsApp Business API in a few clicks. Keep the number you already print on your packaging.',
    time: '~10 minutes',
  },
  {
    n: '2',
    hue: 'coral',
    title: 'Teach your agent',
    body: 'Drop in your catalogue, policies and FAQs, then argue with it in the playground until it answers the way you would.',
    time: 'One afternoon',
  },
  {
    n: '3',
    hue: 'sky',
    title: 'Watch deals land',
    body: 'Chats arrive answered and tagged, deals move across your pipeline, and the follow-ups nobody had time for send themselves.',
    time: 'From day one',
  },
] as const;

export function Lp2Steps() {
  return (
    <section className="bg-(--lp2-mint) py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead
          hue="coral"
          title="Live by Thursday. Genuinely."
          highlight="by Thursday"
          subtitle="No implementation project, no six-week onboarding call series, no consultant. Three steps and you're taking orders."
        />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative">
              {/* Dashed run between cards. Hidden on the last one and on
                  stacked layouts, where the cards already read top to
                  bottom without help. */}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-14 -right-4 hidden h-0.5 w-8 md:block"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(90deg, color-mix(in oklab, var(--lp2-ink) 25%, transparent) 0 6px, transparent 6px 12px)',
                  }}
                />
              )}

              <div className="flex h-full flex-col rounded-xl border-2 border-(--lp2-ink) bg-white p-6 transition-transform duration-200 hover:-translate-y-1">
                <span
                  className="lp2-display flex size-14 items-center justify-center rounded-xl text-2xl font-extrabold"
                  style={{ backgroundColor: `var(--lp2-${s.hue})` }}
                >
                  {s.n}
                </span>

                <h3 className="lp2-display mt-5 text-2xl font-extrabold">
                  {s.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-(--lp2-ink-soft)">
                  {s.body}
                </p>

                <p className="mt-5 flex items-center gap-1.5 border-t border-(--lp2-ink)/10 pt-4 text-xs font-extrabold tracking-wide uppercase">
                  <Sparkle color="pop" className="size-3.5" />
                  {s.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
