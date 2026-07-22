'use client';

import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

import { DEFAULT_BRAND_COLOR, isHexColor, type WidgetConfig } from '@/lib/widget/config';

/**
 * A React mirror of what src/lib/widget/runtime.ts renders in the
 * browser — same layout, colours, and copy, at roughly 85% scale.
 *
 * It is deliberately a *re-implementation* rather than the real script:
 * running the actual widget here would attach a fixed-position element
 * to the dashboard and fight the settings page for the corner of the
 * screen. The trade is that the two can drift, so keep changes to the
 * runtime's markup mirrored here — the visual details worth matching are
 * the header, the WhatsApp-green chat backdrop, and the pill CTA.
 */
export function WidgetPreview({ config }: { config: WidgetConfig }) {
  const [open, setOpen] = useState(true);

  // The runtime falls back the same way, via sanitizeWidgetConfig.
  const color = isHexColor(config.brandColor)
    ? config.brandColor
    : DEFAULT_BRAND_COLOR;
  const name = config.businessName || 'WhatsApp';
  const alignRight = config.placement === 'right';

  return (
    <div
      className="border-border relative overflow-hidden rounded-xl border"
      // A neutral stand-in for "the customer's website" so the widget's
      // own white panel reads as a distinct surface in both themes.
      style={{
        background:
          'repeating-linear-gradient(45deg, rgba(127,127,127,.07) 0 10px, transparent 10px 20px)',
      }}
    >
      <div
        className={`flex min-h-72 flex-col justify-end p-3 ${
          alignRight ? 'items-end' : 'items-start'
        }`}
      >
        {open && (
          <div className="mb-2.5 w-[260px] overflow-hidden rounded-2xl bg-white shadow-xl">
            {/* header */}
            <div
              className="flex items-center gap-2.5 px-3.5 py-3 text-white"
              style={{ backgroundColor: color }}
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/25 text-[13px] font-bold uppercase">
                {name.trim().charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{name}</div>
                {config.tagline && (
                  <div className="truncate text-[10px] opacity-85">
                    {config.tagline}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close preview panel"
                className="rounded p-0.5 opacity-85 hover:bg-white/20 hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>

            {/* greeting */}
            <div className="bg-[#ECE5DD] px-3.5 py-4">
              <div className="max-w-full rounded-[0_9px_9px_9px] bg-white px-3 py-2 text-[12px] leading-snug break-words whitespace-pre-wrap text-neutral-900 shadow-sm">
                {config.greeting || 'Hi there! How can we help you today?'}
              </div>
            </div>

            {/* cta */}
            <div className="bg-[#ECE5DD] px-3.5 pt-1 pb-3.5">
              <div
                className="flex items-center justify-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold text-white"
                style={{ backgroundColor: color }}
              >
                <MessageCircle className="size-4" />
                Start chat
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close preview panel' : 'Open preview panel'}
          className="flex size-[52px] items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105"
          style={{ backgroundColor: color }}
        >
          {open ? (
            <X className="size-6" />
          ) : (
            <MessageCircle className="size-6" />
          )}
        </button>
      </div>

      {!config.enabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-[1px]">
          <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-neutral-900">
            Widget is turned off
          </span>
        </div>
      )}
    </div>
  );
}
