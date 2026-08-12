'use client';

import { useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  QrCode,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';

import {
  DENSE_MESSAGE_CHARS,
  MAX_MESSAGE_CHARS,
  MESSAGE_PRESETS,
  buildWaLink,
  isValidWaNumber,
  normalizeWaNumber,
  qrFileName,
} from '@/lib/qr/wa-link';
import { cn } from '@/lib/utils';
import { press } from './ui';

// ============================================================
// The public WhatsApp QR generator.
//
// This used to live behind the login at /qr-code, where the number was
// never typed: it was pinned to the account's own connected WhatsApp
// Business number, because a QR pointing somewhere else would send
// scans where the CRM could not see them.
//
// Out here that constraint does not exist and would be nonsense — a
// visitor has no account and no connected number — so the number is an
// input, validated by the same `isValidWaNumber` the rest of the app
// uses.
//
// EVERYTHING RUNS IN THE BROWSER. No number, no message and no
// generated code is sent anywhere: `qrcode` encodes locally and the
// downloads are Blobs. That is worth knowing before typing your own
// phone number into a stranger's website, so the page says it too.
// ============================================================

/**
 * The preview sits on a white card that already supplies quiet zone, so
 * a tight margin looks better on screen. A downloaded file has no such
 * backdrop — it needs the spec's 4-module quiet zone baked in or
 * scanners struggle once it is printed onto a coloured poster.
 */
const PREVIEW_MARGIN = 2;
const DOWNLOAD_MARGIN = 4;

/** Big enough to print at poster size without visible resampling. */
const DOWNLOAD_PX = 1024;

/** QR codes must stay dark-on-light to scan — never themed. */
const QR_COLORS = { dark: '#000000', light: '#ffffff' } as const;

/** What Generate produced, pinned to the link it encodes. */
interface GeneratedQr {
  link: string;
  svg: string;
}

const field =
  'h-12 w-full rounded-xl border-2 border-(--lp2-ink)/15 bg-white px-4 text-base outline-none transition-colors focus:border-(--lp2-ink)';

export function Lp2QrTool() {
  const [number, setNumber] = useState('');
  const [message, setMessage] = useState('');
  const [generated, setGenerated] = useState<GeneratedQr | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const digits = normalizeWaNumber(number);
  // Only complain once there is enough typed to be wrong about. Marking
  // "9" invalid while someone is still on the first keystroke is noise.
  const numberTouched = digits.length >= 6;
  const numberOk = isValidWaNumber(digits);

  // What the current inputs *would* encode. Nothing renders it until
  // Generate is pressed — it exists to build on click, and to spot when
  // the inputs have drifted from what is on screen.
  const pendingLink = useMemo(
    () => buildWaLink({ number, message }),
    [number, message]
  );
  const stale = generated !== null && generated.link !== pendingLink;
  const dense = message.length > DENSE_MESSAGE_CHARS;

  async function generate() {
    if (!pendingLink) return;
    setGenerating(true);
    try {
      const svg = await QRCode.toString(pendingLink, {
        type: 'svg',
        margin: PREVIEW_MARGIN,
        color: QR_COLORS,
      });
      setGenerated({ link: pendingLink, svg });
    } catch {
      setGenerated(null);
    } finally {
      setGenerating(false);
    }
  }

  async function copyLink() {
    if (!generated) return;
    await navigator.clipboard.writeText(generated.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /** Push a Blob/data URL at the browser as a file download. */
  function save(href: string, filename: string) {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.click();
  }

  // Downloads re-encode from the *generated* link, never the live
  // inputs, so the file always matches the code on screen even if the
  // message box has been edited since.
  async function downloadPng() {
    if (!generated) return;
    const url = await QRCode.toDataURL(generated.link, {
      width: DOWNLOAD_PX,
      margin: DOWNLOAD_MARGIN,
      color: QR_COLORS,
    });
    save(url, qrFileName(number, 'png'));
  }

  async function downloadSvg() {
    if (!generated) return;
    const out = await QRCode.toString(generated.link, {
      type: 'svg',
      margin: DOWNLOAD_MARGIN,
      color: QR_COLORS,
    });
    const url = URL.createObjectURL(
      new Blob([out], { type: 'image/svg+xml' })
    );
    save(url, qrFileName(number, 'svg'));
    // The anchor click is synchronous, but revoking in the same tick
    // races the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {/* ── Inputs ───────────────────────────────────────────── */}
      <div className="space-y-7">
        <div>
          <label
            htmlFor="qr-number"
            className="block text-sm font-bold sm:text-base"
          >
            WhatsApp number
          </label>
          <p className="mt-1 text-sm text-(--lp2-ink-soft)">
            With the country code, and no leading zeros — 91 for India.
          </p>
          <input
            id="qr-number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="+91 98765 43210"
            aria-invalid={numberTouched && !numberOk}
            className={cn(
              'mt-3',
              field,
              numberTouched && !numberOk && 'border-(--lp2-coral)'
            )}
          />
          {numberTouched && !numberOk && (
            <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-(--lp2-coral)">
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              That does not look like a full international number yet.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label
              htmlFor="qr-message"
              className="block text-sm font-bold sm:text-base"
            >
              Pre-filled message
            </label>
            <span
              className={cn(
                'text-xs tabular-nums',
                dense ? 'font-bold text-(--lp2-tangerine)' : 'text-(--lp2-ink-soft)'
              )}
            >
              {message.length} / {MAX_MESSAGE_CHARS}
            </span>
          </div>
          <p className="mt-1 text-sm text-(--lp2-ink-soft)">
            Optional. Whoever scans lands in a chat with this already
            typed — all they do is hit send.
          </p>

          {/* Starters — one click beats staring at an empty box. */}
          <div className="mt-3 flex flex-wrap gap-2">
            {MESSAGE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setMessage(preset.message)}
                className="rounded-full border border-(--lp2-ink)/15 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-(--lp2-cream)"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <textarea
            id="qr-message"
            value={message}
            onChange={(e) =>
              setMessage(e.target.value.slice(0, MAX_MESSAGE_CHARS))
            }
            rows={4}
            placeholder="Hi! I'd like to know more about your pricing."
            className={cn(field, 'mt-3 h-auto py-3 leading-relaxed')}
          />

          {dense && (
            <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-(--lp2-tangerine)">
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              Long messages pack more squares into the code, which makes it
              harder to scan from a distance. Keep it short for posters.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={generate}
          disabled={!pendingLink || generating}
          className={cn(
            'inline-flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-grass) px-7 text-base font-bold text-white shadow-(--lp2-shadow)',
            press,
            'disabled:pointer-events-none disabled:opacity-40'
          )}
        >
          {generating ? (
            <Loader2 className="size-5 animate-spin" />
          ) : stale ? (
            <RefreshCw className="size-5" strokeWidth={2.75} />
          ) : (
            <QrCode className="size-5" strokeWidth={2.75} />
          )}
          {stale ? 'Update QR code' : 'Generate QR code'}
        </button>
      </div>

      {/* ── Result ───────────────────────────────────────────── */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-3xl border-2 border-(--lp2-ink) bg-white p-5 shadow-(--lp2-shadow)">
          {/* Always white — a tinted QR will not scan. */}
          <div className="flex aspect-square items-center justify-center rounded-2xl bg-white p-3 ring-1 ring-(--lp2-ink)/10">
            {generated ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(generated.svg)}`}
                alt={`WhatsApp QR code for ${digits}`}
                className="h-full w-full"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <QrCode className="size-10 text-(--lp2-ink)/20" />
                <p className="max-w-40 text-xs text-(--lp2-ink-soft)">
                  Your code appears here
                </p>
              </div>
            )}
          </div>

          {generated && (
            <div className="mt-4 space-y-3">
              {/* The code on screen encodes the old inputs until it is
                  regenerated — say so rather than let someone print a QR
                  that does not match what they just typed. */}
              {stale && (
                <p className="flex items-start gap-1.5 text-xs font-medium text-(--lp2-tangerine)">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" />
                  Your details changed. This code still has the old ones —
                  press Update to refresh it.
                </p>
              )}

              <p className="rounded-xl bg-(--lp2-cream) px-3 py-2 text-xs break-all text-(--lp2-ink-soft)">
                {generated.link}
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={downloadPng}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-(--lp2-ink) bg-white text-sm font-bold transition-colors hover:bg-(--lp2-cream)"
                >
                  <Download className="size-4" strokeWidth={2.75} />
                  PNG
                </button>
                <button
                  type="button"
                  onClick={downloadSvg}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-(--lp2-ink) bg-white text-sm font-bold transition-colors hover:bg-(--lp2-cream)"
                >
                  <Download className="size-4" strokeWidth={2.75} />
                  SVG
                </button>
              </div>

              <button
                type="button"
                onClick={copyLink}
                className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-(--lp2-ink) bg-(--lp2-lemon) text-sm font-bold transition-colors"
              >
                {copied ? (
                  <Check className="size-4" strokeWidth={2.75} />
                ) : (
                  <Copy className="size-4" strokeWidth={2.75} />
                )}
                {copied ? 'Copied' : 'Copy link'}
              </button>

              <a
                href={generated.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-medium text-(--lp2-ink-soft) transition-colors hover:text-(--lp2-ink)"
              >
                <ExternalLink className="size-3.5" />
                Test it in WhatsApp
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
