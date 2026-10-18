'use client';

import {
  ArrowLeft,
  EllipsisVertical,
  Globe,
  Mail,
  MapPin,
  Phone,
  Search,
  Store,
  Video,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * What a customer sees when they tap the business's name in WhatsApp —
 * the business-info screen — drawn in a phone frame beside the Business
 * Profile form and updated as it's typed. Light theme, WhatsApp's own
 * colours. An empty field shows a faint placeholder in its place, so
 * it's clear where each one lands.
 */
export function BusinessProfilePreview({
  name,
  phone,
  photoUrl,
  about,
  description,
  category,
  address,
  email,
  websites,
}: {
  name: string;
  phone: string | null;
  photoUrl: string | null;
  about: string;
  description: string;
  /** Human label; null when no industry is set. */
  category: string | null;
  address: string;
  email: string;
  websites: string[];
}) {
  return (
    <div className="mx-auto w-[300px]">
      <p className="text-muted-foreground mb-3 text-center text-xs font-medium">
        What customers see
      </p>

      {/* Phone frame */}
      <div className="overflow-hidden rounded-[2.4rem] border-[9px] border-neutral-900 bg-[#f0f2f5] shadow-xl dark:border-neutral-700">
        <div className="relative h-[600px] [scrollbar-width:none] overflow-y-auto [&::-webkit-scrollbar]:hidden">
          {/* Status bar */}
          <div className="flex items-center justify-between bg-white px-5 pt-2 text-[10px] font-semibold text-[#111b21]">
            <span>9:41</span>
            <span className="h-4 w-16 rounded-full bg-neutral-900" />
            <span>100%</span>
          </div>

          {/* Header — photo, name, number, category */}
          <div className="bg-white px-4 pt-2 pb-4">
            <div className="flex items-center justify-between text-[#54656f]">
              <ArrowLeft className="size-5" />
              <EllipsisVertical className="size-5" />
            </div>
            <div className="mt-1 flex flex-col items-center text-center">
              <span className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-[#dfe5e7] text-3xl font-semibold text-[#54656f]">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  (name || 'B').charAt(0).toUpperCase()
                )}
              </span>
              <p className="mt-3 text-xl leading-tight font-medium text-[#111b21]">
                {name || 'Your business'}
              </p>
              {phone && <p className="mt-1 text-sm text-[#667781]">{phone}</p>}
              <p
                className={cn(
                  'mt-1 text-sm',
                  category ? 'text-[#667781]' : 'text-[#667781]/50'
                )}
              >
                {category ?? 'Business account'}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Action icon={Phone} label="Audio" />
              <Action icon={Video} label="Video" />
              <Action icon={Search} label="Search" />
            </div>
          </div>

          {/* About */}
          <Section>
            <Placeholderable
              value={about}
              placeholder="About — a short tagline"
              className="text-[15px]"
            />
          </Section>

          {/* Business info */}
          <Section>
            <Placeholderable
              value={description}
              placeholder="Description — what your business does"
              className="text-sm leading-relaxed whitespace-pre-wrap"
            />
            <div className="mt-3 space-y-3">
              {category && <InfoRow icon={Store} text={category} />}
              <InfoRow icon={MapPin} text={address} placeholder="Address" />
              <InfoRow icon={Mail} text={email} placeholder="Email" link />
              {(websites.length > 0 ? websites : ['']).map((w, i) => (
                <InfoRow
                  key={i}
                  icon={Globe}
                  text={w}
                  placeholder="Website"
                  link
                />
              ))}
            </div>
          </Section>

          <p className="px-6 py-4 text-center text-[11px] leading-snug text-[#667781]">
            This business uses a secure service from Meta to manage this chat.
          </p>
        </div>
      </div>
    </div>
  );
}

function Action({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="flex flex-col items-center gap-1 rounded-xl border border-[#e9edef] py-2 text-[#00a884]">
      <Icon className="size-5" />
      <span className="text-[11px] text-[#111b21]">{label}</span>
    </span>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 bg-white px-5 py-4">{children}</div>;
}

/** The value, or a faint placeholder where it would go. */
function Placeholderable({
  value,
  placeholder,
  className,
}: {
  value: string;
  placeholder: string;
  className?: string;
}) {
  const text = value.trim();
  return (
    <p
      className={cn(
        className,
        text ? 'text-[#111b21]' : 'text-[#667781]/50 italic'
      )}
    >
      {text || placeholder}
    </p>
  );
}

function InfoRow({
  icon: Icon,
  text,
  placeholder,
  link = false,
}: {
  icon: LucideIcon;
  text: string;
  placeholder?: string;
  /** Email and websites show as links in WhatsApp. */
  link?: boolean;
}) {
  const value = text.trim();
  if (!value && !placeholder) return null;
  return (
    <div className="flex items-start gap-3.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-[#54656f]" />
      <span
        className={cn(
          'min-w-0 text-sm break-words',
          !value
            ? 'text-[#667781]/50 italic'
            : link
              ? 'text-[#027eb5]'
              : 'text-[#111b21]'
        )}
      >
        {value || placeholder}
      </span>
    </div>
  );
}
