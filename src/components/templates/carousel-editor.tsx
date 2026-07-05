'use client';

import { useState } from 'react';
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  Film,
  RefreshCw,
  Play,
  X,
} from 'lucide-react';

import type { CarouselCard, TemplateButton } from '@/types';
import { TEMPLATE_LIMITS } from '@/lib/whatsapp/template-validators';
import { MediaLibraryPicker } from '@/components/media/media-library-picker';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Format = 'image' | 'video';
type ButtonType = 'QUICK_REPLY' | 'URL';

const MAX_CARDS = TEMPLATE_LIMITS.maxCarouselCards;
const MIN_CARDS = TEMPLATE_LIMITS.minCarouselCards;
const MAX_BTNS = TEMPLATE_LIMITS.maxCarouselCardButtons;
const CARD_BODY_MAX = TEMPLATE_LIMITS.carouselCardBodyMaxLength;

function emptyButton(type: ButtonType): TemplateButton {
  return type === 'URL'
    ? { type: 'URL', text: '', url: '' }
    : { type: 'QUICK_REPLY', text: '' };
}

/** Force every card's buttons to match `types` (by index), preserving
 *  existing values where the slot type is unchanged. Keeps all cards on
 *  the same button structure — a Meta requirement. */
function applyStructure(
  cards: CarouselCard[],
  types: ButtonType[],
): CarouselCard[] {
  return cards.map((card) => ({
    ...card,
    buttons: types.map((t, j) => {
      const existing = card.buttons[j];
      return existing && existing.type === t ? existing : emptyButton(t);
    }),
  }));
}

export function CarouselEditor({
  format,
  onFormatChange,
  cards,
  onChange,
}: {
  format: Format;
  onFormatChange: (f: Format) => void;
  cards: CarouselCard[];
  onChange: (cards: CarouselCard[]) => void;
}) {
  const [pickerCard, setPickerCard] = useState<number | null>(null);

  // Shared button structure lives on card 0 (every card mirrors it).
  const buttonTypes: ButtonType[] = (cards[0]?.buttons ?? []).map(
    (b) => b.type as ButtonType,
  );

  function patchCard(i: number, patch: Partial<CarouselCard>) {
    onChange(cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function addCard() {
    if (cards.length >= MAX_CARDS) return;
    onChange([
      ...cards,
      { media_url: '', body_text: '', buttons: buttonTypes.map(emptyButton) },
    ]);
  }

  function removeCard(i: number) {
    onChange(cards.filter((_, idx) => idx !== i));
  }

  function setFormat(f: Format) {
    if (f === format) return;
    // Media no longer matches the new format — clear it on every card.
    onChange(
      cards.map((c) => ({ ...c, media_url: '', media_handle: undefined })),
    );
    onFormatChange(f);
  }

  function addButtonSlot(type: ButtonType) {
    if (buttonTypes.length >= MAX_BTNS) return;
    onChange(applyStructure(cards, [...buttonTypes, type]));
  }

  function changeButtonType(slot: number, type: ButtonType) {
    const next = [...buttonTypes];
    next[slot] = type;
    onChange(applyStructure(cards, next));
  }

  function removeButtonSlot(slot: number) {
    onChange(applyStructure(cards, buttonTypes.filter((_, j) => j !== slot)));
  }

  function patchButtonValue(
    cardIdx: number,
    slot: number,
    patch: Partial<TemplateButton>,
  ) {
    const card = cards[cardIdx];
    const buttons = card.buttons.map((b, j) =>
      j === slot ? ({ ...b, ...patch } as TemplateButton) : b,
    );
    patchCard(cardIdx, { buttons });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
      {/* Header: title + media-format toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Carousel cards
            <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
              {cards.length}/{MAX_CARDS}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {MIN_CARDS}–{MAX_CARDS} swipeable cards · all cards share the same
            media type and buttons.
          </p>
        </div>

        <div
          role="group"
          aria-label="Card media type"
          className="inline-flex items-center rounded-lg border border-border bg-card p-0.5"
        >
          {(['image', 'video'] as Format[]).map((f) => {
            const Icon = f === 'image' ? ImageIcon : Film;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                aria-pressed={format === f}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  format === f
                    ? 'bg-primary-soft text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="size-4" />
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* Shared button structure */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Buttons on every card:
        </span>
        {buttonTypes.map((t, slot) => (
          <span
            key={slot}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card py-1 pl-2.5 pr-1 text-xs font-medium text-foreground"
          >
            <select
              value={t}
              onChange={(e) =>
                changeButtonType(slot, e.target.value as ButtonType)
              }
              className="bg-transparent outline-none"
              aria-label={`Button ${slot + 1} type`}
            >
              <option value="QUICK_REPLY">Quick reply</option>
              <option value="URL">Visit URL</option>
            </select>
            <button
              type="button"
              onClick={() => removeButtonSlot(slot)}
              aria-label="Remove button"
              className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {buttonTypes.length < MAX_BTNS && (
          <>
            <button
              type="button"
              onClick={() => addButtonSlot('QUICK_REPLY')}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Plus className="size-3" /> Quick reply
            </button>
            <button
              type="button"
              onClick={() => addButtonSlot('URL')}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Plus className="size-3" /> URL
            </button>
          </>
        )}
      </div>

      {/* Card strip — horizontal, like the real carousel */}
      <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
        {cards.map((card, i) => (
          <div
            key={i}
            className="group/card w-60 shrink-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
          >
            {/* Media */}
            <div className="relative aspect-4/3 bg-muted">
              {card.media_url ? (
                <>
                  {format === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.media_url}
                      alt={`Card ${i + 1}`}
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
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <span className="flex size-9 items-center justify-center rounded-full bg-black/45">
                          <Play className="size-4 fill-white text-white" />
                        </span>
                      </span>
                    </>
                  )}
                  {/* Change media — hover */}
                  <div className="absolute inset-x-0 bottom-0 flex justify-end bg-linear-to-t from-black/50 to-transparent p-1.5 opacity-0 transition-opacity group-hover/card:opacity-100">
                    <button
                      type="button"
                      onClick={() => setPickerCard(i)}
                      title="Change media"
                      className="flex size-7 items-center justify-center rounded-md bg-white/90 text-neutral-800 transition-colors hover:bg-white"
                    >
                      <RefreshCw className="size-3.5" />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerCard(i)}
                  className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-primary"
                >
                  <span className="flex size-10 items-center justify-center rounded-full border border-border bg-background shadow-sm">
                    <Plus className="size-4.5" />
                  </span>
                  <span className="text-[11px] font-medium">Add {format}</span>
                </button>
              )}

              {/* Card number */}
              <span className="absolute left-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/55 px-1.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                {i + 1}
              </span>

              {/* Delete card */}
              <button
                type="button"
                onClick={() => removeCard(i)}
                aria-label={`Remove card ${i + 1}`}
                title="Remove card"
                className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-red-600 group-hover/card:opacity-100"
              >
                <Trash2 className="size-3" />
              </button>
            </div>

            {/* Body */}
            <div className="px-2.5 pt-1.5">
              <Textarea
                value={card.body_text}
                onChange={(e) => patchCard(i, { body_text: e.target.value })}
                placeholder="Card text…"
                maxLength={CARD_BODY_MAX}
                className="min-h-16 resize-none border-0 bg-transparent p-1 text-[13px] text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
              />
              <p className="pb-1.5 text-right text-[10px] text-muted-foreground">
                {card.body_text.length}/{CARD_BODY_MAX}
              </p>
            </div>

            {/* Button values */}
            {card.buttons.length > 0 && (
              <div className="border-t border-border">
                {card.buttons.map((b, slot) => (
                  <div
                    key={slot}
                    className="space-y-1.5 border-b border-border p-2 last:border-b-0"
                  >
                    <Input
                      value={b.text}
                      onChange={(e) =>
                        patchButtonValue(i, slot, { text: e.target.value })
                      }
                      placeholder={
                        b.type === 'URL' ? 'Button label' : 'Quick reply label'
                      }
                      maxLength={TEMPLATE_LIMITS.buttonTextMaxLength}
                      className="h-8 border-border bg-muted/40 text-xs text-foreground placeholder:text-muted-foreground"
                    />
                    {b.type === 'URL' && (
                      <Input
                        value={b.url}
                        onChange={(e) =>
                          patchButtonValue(i, slot, { url: e.target.value })
                        }
                        placeholder="https://…"
                        className="h-8 border-border bg-muted/40 text-xs text-foreground placeholder:text-muted-foreground"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Add-card tile */}
        {cards.length < MAX_CARDS && (
          <button
            type="button"
            onClick={addCard}
            className="flex min-h-60 w-60 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary-soft/30 hover:text-primary"
          >
            <span className="flex size-10 items-center justify-center rounded-full border border-border bg-card shadow-sm">
              <Plus className="size-5" />
            </span>
            <span className="text-xs font-medium">Add card</span>
          </button>
        )}
      </div>

      {/* Media picker */}
      {pickerCard !== null && (
        <MediaLibraryPicker
          open={pickerCard !== null}
          onOpenChange={(open) => !open && setPickerCard(null)}
          kind={format}
          onSelect={(item) => {
            patchCard(pickerCard, {
              media_url: item.public_url,
              media_handle: undefined,
            });
            setPickerCard(null);
          }}
        />
      )}
    </div>
  );
}
