'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageTemplate } from '@/types';
import { Contact } from '@/types';
import type { CarouselCard } from '@/types';
import {
  Smartphone,
  Smile,
  Paperclip,
  Mic,
  Phone,
  ChevronLeft,
  ImageIcon,
  FileText,
  Play,
  MoreVertical,
  ExternalLink,
  Reply,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────

type VariableMapping = {
  type: 'static' | 'field' | 'custom_field';
  value: string;
};

interface CampaignPreviewProps {
  template: MessageTemplate | null;
  variables: Record<string, VariableMapping>;
  businessName?: string;
  contact?: Contact | null;
  contactCustomValues?: Map<string, string>;
}

// ─── WhatsApp palette ─────────────────────────────────────────────

const WA = {
  header: '#00a884',
  headerDark: '#008069',
  chatBg: '#efeae2',
  outgoing: '#d9fdd3',
  incoming: '#ffffff',
  buttonText: '#027eb5',
  inputBg: '#f0f2f5',
  tick: '#53bdeb',
} as const;

// ─── Sample data fallback ────────────────────────────────────────

const SAMPLE_CONTACT: Contact = {
  id: 'sample',
  user_id: '',
  account_id: '',
  name: 'John Doe',
  phone: '+1 (555) 123-4567',
  email: 'john@example.com',
  company: 'Acme Corp',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ─── Helpers ──────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getPreviewText(
  template: MessageTemplate,
  variables: Record<string, VariableMapping>,
  contact: Contact | null,
  customValues: Map<string, string>,
): string {
  const c = contact ?? SAMPLE_CONTACT;
  const cv = contact ? customValues : new Map<string, string>();

  const placeholders = template.body_text.match(/\{\{(\d+)\}\}/g);
  if (!placeholders) return template.body_text;

  let text = template.body_text;
  for (const placeholder of [...new Set(placeholders)]) {
    const key = placeholder.replace(/^\{\{|\}\}$/g, '');
    const mapping = variables[key];
    let replacement = placeholder;

    if (mapping) {
      if (mapping.type === 'static' && mapping.value) {
        replacement = mapping.value;
      } else if (mapping.type === 'field' && mapping.value) {
        const fieldMap: Record<string, string | undefined> = {
          name: c.name,
          phone: c.phone ?? undefined,
          email: c.email,
          company: c.company,
        };
        replacement = fieldMap[mapping.value] ?? placeholder;
      } else if (mapping.type === 'custom_field' && mapping.value) {
        replacement = cv.get(mapping.value) || placeholder;
      }
    }
    text = text.replaceAll(placeholder, replacement);
  }
  return text;
}

// ─── iOS Status Bar ───────────────────────────────────────────────

/** Current wall-clock time in the iPhone's h:mm style (no AM/PM). */
function formatClock(d: Date): string {
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function StatusBar() {
  const [time, setTime] = useState(() => formatClock(new Date()));

  // Tick every 30s so the mock's clock stays honest while the page
  // sits open. Cheap — one small text node re-renders.
  useEffect(() => {
    const id = setInterval(() => setTime(formatClock(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute left-0 right-0 top-0 z-30 flex h-9.5 items-center px-5">
      <span
        className="text-[12px] font-semibold leading-none text-white"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
      >
        {time}
      </span>
      <div className="flex-1" />
      <div className="flex items-center gap-1.25">
        {/* Cellular signal */}
        <svg width="13" height="9" viewBox="0 0 18 12" fill="white" aria-hidden>
          <rect x="0" y="8.5" width="3.2" height="3.5" rx="0.8" />
          <rect x="4.8" y="5.5" width="3.2" height="6.5" rx="0.8" />
          <rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.8" />
          <rect x="14.4" y="0" width="3.2" height="12" rx="0.8" />
        </svg>
        {/* WiFi */}
        <svg width="12" height="9" viewBox="0 0 16 12" fill="none" aria-hidden>
          <circle cx="8" cy="10.5" r="1.5" fill="white" />
          <path
            d="M4.5 7.2a4.95 4.95 0 0 1 7 0"
            stroke="white"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M1.5 4.2a9 9 0 0 1 13 0"
            stroke="white"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        {/* Battery */}
        <div className="flex items-center" aria-hidden>
          <div
            className="relative h-2.25 w-4.5 rounded-[2px]"
            style={{ border: '1px solid rgba(255,255,255,0.8)' }}
          >
            <div className="absolute inset-px right-[2.5px] rounded-[1px] bg-white" />
          </div>
          <div className="ml-px h-1 w-[1.5px] rounded-r-sm bg-white/50" />
        </div>
      </div>
    </div>
  );
}

// ─── Phone Frame ──────────────────────────────────────────────────

function SideButton({
  side,
  top,
  height,
}: {
  side: 'left' | 'right';
  top: number;
  height: number;
}) {
  const isLeft = side === 'left';
  return (
    <div
      className="absolute"
      aria-hidden
      style={{
        [isLeft ? 'right' : 'left']: 'calc(100% - 1px)',
        top,
        width: 7,
        height,
        borderRadius: isLeft ? '3px 0 0 3px' : '0 3px 3px 0',
        background: isLeft
          ? 'linear-gradient(to right, #4a4a4c, #3a3a3c)'
          : 'linear-gradient(to left, #4a4a4c, #3a3a3c)',
        boxShadow: isLeft
          ? '-1px 0 2px rgba(0,0,0,0.4)'
          : '1px 0 2px rgba(0,0,0,0.4)',
      }}
    />
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      {/* Ambient glow */}
      <div
        className="absolute -inset-6 rounded-[4rem] blur-2xl"
        style={{ background: 'radial-gradient(ellipse, rgba(0,168,132,0.18) 0%, transparent 70%)' }}
        aria-hidden
      />

      {/* Device chassis */}
      <div
        className="relative shadow-2xl"
        style={{
          borderRadius: '3rem',
          padding: '10px',
          background:
            'linear-gradient(160deg, #525254 0%, #2c2c2e 30%, #1c1c1e 60%, #2a2a2c 100%)',
          boxShadow:
            '0 0 0 0.5px rgba(255,255,255,0.12) inset, 0 0 0 1px rgba(0,0,0,0.6), 0 32px 64px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* Left buttons: action button + volume */}
        <SideButton side="left" top={62} height={28} />
        <SideButton side="left" top={102} height={44} />
        <SideButton side="left" top={155} height={44} />

        {/* Right button: power */}
        <SideButton side="right" top={116} height={68} />

        {/* Screen */}
        <div
          className="relative flex w-full flex-col overflow-hidden"
          style={{
            backgroundColor: WA.headerDark,
            borderRadius: '2.4rem',
            aspectRatio: '393 / 852',
            boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.08)',
          }}
        >
          {/* Dynamic Island */}
          <div
            className="absolute left-1/2 z-30 -translate-x-1/2"
            style={{ top: 10 }}
            aria-hidden
          >
            <div
              className="bg-black"
              style={{
                width: 90,
                height: 26,
                borderRadius: 16,
                boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
              }}
            />
          </div>

          {/* iOS Status bar */}
          <StatusBar />

          {/* Screen surface glare */}
          <div
            className="pointer-events-none absolute inset-0 z-20"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0) 45%)',
            }}
            aria-hidden
          />

          {/* Content — pushed below status bar */}
          <div className="flex min-h-0 flex-1 flex-col pt-9.5">
            {children}
          </div>

          {/* Home indicator */}
          <div className="absolute bottom-2 left-1/2 z-30 -translate-x-1/2" aria-hidden>
            <div
              className="rounded-full bg-white/50"
              style={{ width: 100, height: 4 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Chat wallpaper ───────────────────────────────────────────────

function ChatWallpaper() {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundColor: WA.chatBg,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c8b8a8' fill-opacity='0.18'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }}
      aria-hidden
    />
  );
}

// ─── WhatsApp Header ──────────────────────────────────────────────

function WhatsAppHeader({ businessName }: { businessName: string }) {
  const initial = businessName.charAt(0).toUpperCase();
  return (
    <div
      className="relative z-10 shrink-0 shadow-md"
      style={{ background: WA.headerDark }}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <div className="flex items-center">
          <ChevronLeft className="h-5 w-5 text-white/90" strokeWidth={2.5} />
        </div>

        {/* Avatar */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)' }}
        >
          {initial}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="truncate text-[14px] font-semibold leading-tight text-white">
              {businessName}
            </p>
            {/* Verified business badge */}
            <svg width="13" height="13" viewBox="0 0 24 24" aria-label="Verified business" fill="none">
              <circle cx="12" cy="12" r="12" fill="rgba(255,255,255,0.2)" />
              <path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-[11px] text-white/70">Business account</p>
        </div>

        <div className="flex items-center gap-4 pr-1 text-white/90">
          <Phone className="h-[17px] w-[17px]" strokeWidth={1.75} />
          <MoreVertical className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────

function HeaderMedia({
  headerType,
  header,
  mediaUrl,
}: {
  headerType: string;
  header?: string;
  mediaUrl?: string;
}) {
  if (headerType === 'image') {
    // Show the actual chosen image once a URL is set; otherwise fall
    // back to the generic placeholder while the user is still picking.
    if (mediaUrl) {
      return (
        <div className="relative overflow-hidden" style={{ height: 130 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt="Header"
            className="h-full w-full object-cover"
          />
        </div>
      );
    }
    return (
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #c8d8e8 0%, #a0b8cc 100%)',
          height: 130,
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-60">
          <ImageIcon className="h-8 w-8 text-white" strokeWidth={1.5} />
          <span className="text-[10px] font-medium text-white/80">Image</span>
        </div>
      </div>
    );
  }
  if (headerType === 'video') {
    return (
      <div
        className="relative overflow-hidden"
        style={{
          background: mediaUrl
            ? '#000'
            : 'linear-gradient(145deg, #2c3e50 0%, #1a252f 100%)',
          height: 130,
        }}
      >
        {mediaUrl && (
          <video
            src={mediaUrl}
            muted
            preload="metadata"
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <Play className="h-5 w-5 text-white" fill="white" />
          </div>
        </div>
      </div>
    );
  }
  if (headerType === 'document') {
    return (
      <div className="flex items-center gap-2 border-b border-black/5 bg-black/[0.03] px-2.5 py-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#008069]/10">
          <FileText className="h-5 w-5 text-[#008069]" strokeWidth={1.75} />
        </div>
        <p className="truncate text-xs text-[#667781]">{header ?? 'Document'}</p>
      </div>
    );
  }
  return null;
}

function ReadTicks() {
  return (
    <svg
      width="16"
      height="11"
      viewBox="0 0 16 11"
      fill="none"
      aria-label="Read"
    >
      <path
        d="M1 5.5L4.5 9 10 2"
        stroke={WA.tick}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 5.5L9 9 14.5 2"
        stroke={WA.tick}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Horizontal, swipeable row of carousel cards shown below the bubble.
 * Cards span ~80% of the phone width (matching WhatsApp), the scrollbar
 * is hidden, and the strip is drag-to-scroll with a grab cursor.
 */
function CarouselCards({
  cards,
  format,
}: {
  cards: CarouselCard[];
  format: 'image' | 'video';
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startScroll: 0 });

  if (cards.length === 0) return null;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scroller.current;
    if (!el) return;
    drag.current = {
      active: true,
      startX: e.clientX,
      startScroll: el.scrollLeft,
    };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scroller.current;
    if (!el || !drag.current.active) return;
    el.scrollLeft = drag.current.startScroll - (e.clientX - drag.current.startX);
  };
  const endDrag = () => {
    drag.current.active = false;
  };

  return (
    <div
      ref={scroller}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="flex cursor-grab snap-x snap-mandatory gap-2.5 overflow-x-auto px-3 pb-2 pt-1 select-none active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {cards.map((card, i) => (
        <div
          key={i}
          className="w-[80%] shrink-0 snap-start overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5"
        >
          {/* Media */}
          <div className="relative aspect-4/3 w-full bg-[#e9edef]">
            {card.media_url ? (
              format === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.media_url}
                  alt={`Card ${i + 1}`}
                  draggable={false}
                  className="h-full w-full object-cover"
                />
              ) : (
                <>
                  <video
                    src={card.media_url}
                    muted
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45">
                      <Play className="h-5 w-5 text-white" fill="white" />
                    </span>
                  </span>
                </>
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center opacity-50">
                {format === 'image' ? (
                  <ImageIcon className="h-9 w-9 text-[#667781]" />
                ) : (
                  <Play className="h-9 w-9 text-[#667781]" />
                )}
              </div>
            )}
          </div>

          {/* Body */}
          <p className="px-2.5 pt-2 text-[13px] leading-snug text-[#111b21]">
            {card.body_text || (
              <span className="text-[#8696a0]">Card text…</span>
            )}
          </p>

          {/* Buttons */}
          {card.buttons.length > 0 ? (
            <div className="mt-2 border-t border-black/5">
              {card.buttons.map((b, j) => (
                <div
                  key={j}
                  className="flex items-center justify-center gap-1.5 border-b border-black/5 py-2.5 text-[13.5px] font-medium text-[#027eb5] last:border-b-0"
                >
                  {b.type === 'URL' ? (
                    <ExternalLink className="h-3.5 w-3.5" />
                  ) : (
                    <Reply className="h-3.5 w-3.5" />
                  )}
                  {b.text || (b.type === 'URL' ? 'Visit' : 'Reply')}
                </div>
              ))}
            </div>
          ) : (
            <div className="h-2.5" />
          )}
        </div>
      ))}
    </div>
  );
}

function MessageBubble({
  text,
  time,
  isOutgoing,
  footer,
  header,
  headerType,
  mediaUrl,
  buttons,
}: {
  text: string;
  time: Date;
  isOutgoing: boolean;
  footer?: string;
  header?: string;
  headerType?: string;
  mediaUrl?: string;
  buttons?: { text: string }[];
}) {
  const bg = isOutgoing ? WA.outgoing : WA.incoming;
  const hasMedia =
    headerType && headerType !== 'text';

  return (
    <div className={`flex px-2 py-0.5 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      <div className="relative max-w-[88%]">
        {/* Bubble tail */}
        <svg
          className={`absolute bottom-[7px] ${isOutgoing ? '-right-[7px]' : '-left-[7px]'}`}
          width="9"
          height="13"
          viewBox="0 0 9 13"
          fill="none"
          aria-hidden
        >
          {isOutgoing ? (
            <path d="M0 13 Q1 6 0 0 L9 13Z" fill={bg} />
          ) : (
            <path d="M9 13 Q8 6 9 0 L0 13Z" fill={bg} />
          )}
        </svg>

        <div
          className={`relative overflow-hidden ${
            isOutgoing ? 'rounded-xl rounded-br-none' : 'rounded-xl rounded-bl-none'
          }`}
          style={{
            backgroundColor: bg,
            boxShadow: '0 1px 1.5px rgba(0,0,0,0.12)',
          }}
        >
          {/* Media header */}
          {hasMedia && headerType && (
            <HeaderMedia
              headerType={headerType}
              header={header}
              mediaUrl={mediaUrl}
            />
          )}

          {/* Text header */}
          {header && headerType === 'text' && (
            <p className="px-2.5 pt-2.5 text-[13.5px] font-semibold leading-snug text-[#111b21]">
              {header}
            </p>
          )}

          <div className="px-2.5 pb-2.5 pt-1.5">
            <p
              className="whitespace-pre-wrap leading-[1.4] text-[#111b21]"
              style={{ fontSize: '13.5px' }}
            >
              {text}
            </p>

            {footer && (
              <p className="mt-1 text-[10.5px] leading-snug text-[#667781]/60">{footer}</p>
            )}

            {/* Timestamp row */}
            <div className="mt-1.5 flex items-center justify-end gap-1">
              <span className="text-[10.5px] leading-none text-[#667781]">
                {formatTime(time)}
              </span>
              {isOutgoing && <ReadTicks />}
            </div>
          </div>

          {/* Attached buttons */}
          {buttons && buttons.length > 0 && (
            <div className="border-t border-black/6">
              {buttons.map((btn, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-center px-3 py-2 ${
                    i > 0 ? 'border-t border-black/6' : ''
                  }`}
                >
                  <p className="text-[13px] font-medium" style={{ color: WA.buttonText }}>
                    {btn.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Date Separator ───────────────────────────────────────────────

function DateSeparator({ text }: { text: string }) {
  return (
    <div className="flex justify-center px-2 py-3">
      <span
        className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-[#54656f]"
        style={{ backgroundColor: 'rgba(255,255,255,0.88)', boxShadow: '0 1px 1px rgba(0,0,0,0.08)' }}
      >
        {text}
      </span>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────

function EmptyPreviewState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center">
      <div
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.85)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
      >
        <Smartphone className="h-5 w-5" style={{ color: WA.headerDark }} />
      </div>
      <p className="text-[13px] font-semibold text-[#111b21]">No template selected</p>
      <p className="mt-1 text-[11px] leading-relaxed text-[#667781]">
        Choose a template to preview your message
      </p>
    </div>
  );
}

// ─── Input Bar ────────────────────────────────────────────────────

function InputBar() {
  return (
    <div
      className="relative z-10 shrink-0 px-2 pb-6 pt-2"
      style={{ backgroundColor: WA.inputBg }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: '#ffffff' }}
        >
          <Smile className="h-[20px] w-[20px] text-[#54656f]" strokeWidth={1.75} />
        </div>
        <div
          className="flex min-h-[36px] flex-1 items-center rounded-full px-3 py-1.5"
          style={{ backgroundColor: '#ffffff' }}
        >
          <p className="flex-1 text-[13.5px] text-[#8696a0]">Message</p>
          <Paperclip className="h-[17px] w-[17px] text-[#54656f]" strokeWidth={1.75} />
        </div>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: WA.headerDark }}
        >
          <Mic className="h-[17px] w-[17px] text-white" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export function CampaignPreview({
  template,
  variables,
  businessName = 'Your Business',
  contact,
  contactCustomValues,
}: CampaignPreviewProps) {
  const previewText = useMemo(() => {
    if (!template) return '';
    return getPreviewText(
      template,
      variables,
      contact ?? null,
      contactCustomValues ?? new Map<string, string>(),
    );
  }, [template, variables, contact, contactCustomValues]);

  const now = new Date();

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Preview
        </h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          What your recipient sees on WhatsApp
        </p>
      </div>

      <PhoneFrame>
        <WhatsAppHeader businessName={businessName} />

        <div className="relative flex min-h-0 flex-1 flex-col">
          <ChatWallpaper />

          <div className="relative flex-1 overflow-y-auto px-0.5 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {template ? (
              <>
                <DateSeparator text="Today" />

                <MessageBubble
                  text={previewText || template.body_text}
                  time={now}
                  isOutgoing={false}
                  footer={template.template_type === 'carousel' ? undefined : template.footer_text}
                  header={template.header_content}
                  headerType={template.header_type}
                  mediaUrl={template.header_media_url}
                  buttons={template.template_type === 'carousel' ? undefined : template.buttons}
                />

                {template.template_type === 'carousel' && (
                  <CarouselCards
                    cards={template.carousel_cards ?? []}
                    format={template.carousel_card_format ?? 'image'}
                  />
                )}
              </>
            ) : (
              <EmptyPreviewState />
            )}
          </div>

          <InputBar />
        </div>
      </PhoneFrame>
    </div>
  );
}
