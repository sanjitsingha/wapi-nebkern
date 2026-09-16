// Brand panel on the right half of the auth pages (login / signup /
// forgot-password / reset-password / welcome) on lg+ screens. Two lines
// of the landing page's own headline, carrying its two mention-style
// highlights, on the same cream ground. Hidden below lg, where the form
// takes the full width.
//
// The colours are literals rather than the --wa-* tokens the landing
// page uses: those are declared on the marketing layout's `.lp2`
// wrapper, and the auth pages do not sit inside it.
//
// `@container` + `cqw` sizes the type against the panel's own width, the
// way the hero sizes against its column, so the second line fills the
// measure without wrapping to a third at any window size.

export function AuthBrandPanel() {
  return (
    <aside className="@container relative hidden w-1/2 flex-col justify-center overflow-hidden bg-[#fcf5eb] px-12 py-12 lg:flex xl:px-16">
      {/* 6.9cqw is the hero's own figure: that second line runs about
          13.8em, so this fills ~96% of the measure and never a third
          line. Capped at 56px for very wide windows. */}
      <p className="text-[clamp(1.5rem,6.9cqw,3.5rem)] leading-[1.45] font-normal tracking-[-0.02em] text-[#1c1e21]">
        Turn every WhatsApp
        <br />
        <span className="whitespace-nowrap">
          <span className="rounded-[0.14em] border border-[#1fae55] bg-[#d4f5c6] px-[0.12em] text-[#25d366]">
            @conversation
          </span>{' '}
          into{' '}
          <span className="rounded-[0.14em] border border-[#d9a400] bg-[#fff1b8] px-[0.12em] text-[#b27d00]">
            ₹revenue
          </span>
        </span>
      </p>
    </aside>
  );
}
