'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';

import {
  DENSE_MESSAGE_CHARS,
  MAX_MESSAGE_CHARS,
  MESSAGE_PRESETS,
  buildWaLink,
  normalizeWaNumber,
  qrFileName,
} from '@/lib/qr/wa-link';
import { useWhatsAppConnection } from '@/hooks/use-whatsapp-info';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Info,
  Loader2,
  Phone,
  QrCode,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';

/**
 * The preview sits on a white card that already supplies quiet zone, so a
 * tight margin looks better on screen. A downloaded file has no such
 * backdrop — it needs the spec's 4-module quiet zone baked in or scanners
 * struggle once it's printed onto a coloured poster.
 */
const PREVIEW_MARGIN = 2;
const DOWNLOAD_MARGIN = 4;

/** Big enough to print at poster size without visible resampling. */
const DOWNLOAD_PX = 1024;

/** QR codes must stay dark-on-light to scan — never themed. */
const QR_COLORS = { dark: '#000000', light: '#ffffff' } as const;

/** What the Generate button produced, pinned to the link it encodes. */
interface GeneratedQr {
  link: string;
  svg: string;
}

export default function QrCodePage() {
  // The destination is always the account's own connected WhatsApp
  // Business number — there's no field to type one. A QR pointing at some
  // other number would send scans somewhere this CRM can't see.
  const { info: waInfo, status } = useWhatsAppConnection();
  const number = waInfo?.display_phone_number ?? '';
  const connected = status === 'connected' && normalizeWaNumber(number) !== '';

  const [message, setMessage] = useState('');
  const [generated, setGenerated] = useState<GeneratedQr | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // What the current inputs *would* encode. Nothing renders it until
  // Generate is pressed — it only exists to build on click and to spot
  // when the message has drifted from what's on screen.
  const pendingLink = useMemo(
    () => buildWaLink({ number, message }),
    [number, message],
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
      toast.error("Couldn't generate the QR code");
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

  // Downloads re-encode from the *generated* link, never the live inputs,
  // so the file always matches the code on screen even if the message box
  // has been edited since.
  async function downloadPng() {
    if (!generated) return;
    try {
      const url = await QRCode.toDataURL(generated.link, {
        width: DOWNLOAD_PX,
        margin: DOWNLOAD_MARGIN,
        color: QR_COLORS,
      });
      save(url, qrFileName(number, 'png'));
    } catch {
      toast.error("Couldn't generate the PNG");
    }
  }

  async function downloadSvg() {
    if (!generated) return;
    try {
      const out = await QRCode.toString(generated.link, {
        type: 'svg',
        margin: DOWNLOAD_MARGIN,
        color: QR_COLORS,
      });
      const url = URL.createObjectURL(
        new Blob([out], { type: 'image/svg+xml' }),
      );
      save(url, qrFileName(number, 'svg'));
      // The anchor click is synchronous, but revoking in the same tick
      // races the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      toast.error("Couldn't generate the SVG");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-foreground text-2xl font-bold">QR Generator</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Turn your WhatsApp number into a scannable code. Add a pre-filled
          message and whoever scans it lands in a chat with the first message
          already typed — all they do is hit send.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ---- Form -------------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle>Message</CardTitle>
            <CardDescription>
              What the chat says before they hit send.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Connected number — display only. */}
            <div className="space-y-2">
              <Label>
                <Phone className="size-3.5" />
                WhatsApp number
              </Label>

              {status === 'loading' ? (
                <div className="bg-muted h-11 animate-pulse rounded-lg" />
              ) : connected ? (
                <>
                  <div className="border-border bg-muted flex h-11 items-center rounded-lg border px-2.5">
                    <span className="text-foreground text-sm font-medium tabular-nums">
                      {number}
                    </span>
                    {waInfo?.verified_name && (
                      <span className="text-muted-foreground ml-2 truncate text-sm">
                        · {waInfo.verified_name}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Your connected WhatsApp Business number. Scans land in your
                    inbox.
                  </p>
                </>
              ) : (
                <Alert>
                  <TriangleAlert />
                  <AlertTitle>No WhatsApp number connected</AlertTitle>
                  <AlertDescription>
                    Connect your WhatsApp Business number in{' '}
                    <Link href="/settings/whatsapp">Settings → WhatsApp</Link> to
                    generate a QR code.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="qr-message">Pre-filled message</Label>
                <span
                  className={`text-xs tabular-nums ${
                    dense
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-muted-foreground'
                  }`}
                >
                  {message.length} / {MAX_MESSAGE_CHARS}
                </span>
              </div>

              {/* Starters — one click beats staring at an empty box. */}
              <div className="flex flex-wrap gap-1.5 pb-1">
                {MESSAGE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={!connected}
                    onClick={() => setMessage(preset.message)}
                    className="border-border text-muted-foreground hover:bg-muted hover:text-foreground rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <Textarea
                id="qr-message"
                value={message}
                disabled={!connected}
                onChange={(e) =>
                  setMessage(e.target.value.slice(0, MAX_MESSAGE_CHARS))
                }
                rows={4}
                placeholder="Hi! I'd like to know more about your pricing."
                className="min-h-24"
              />

              {dense ? (
                <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" />
                  Long messages pack more squares into the code, which makes it
                  harder to scan from a distance. Keep it short for posters.
                </p>
              ) : (
                <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                  <Info className="mt-px size-3.5 shrink-0" />
                  Optional. Leave it empty to just open an empty chat.
                </p>
              )}
            </div>

            <Button
              onClick={generate}
              disabled={!connected || !pendingLink || generating}
              className="w-full sm:w-auto"
            >
              {generating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : stale ? (
                <RefreshCw className="size-4" />
              ) : (
                <QrCode className="size-4" />
              )}
              {stale ? 'Update QR code' : 'Generate QR code'}
            </Button>
          </CardContent>
        </Card>

        {/* ---- Result ------------------------------------------------ */}
        <Card className="lg:sticky lg:top-6 lg:self-start">
          <CardHeader>
            <CardTitle>Your QR code</CardTitle>
            <CardDescription>
              {generated
                ? 'Print it, or share the link.'
                : 'Nothing generated yet.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Always white, in both themes — a dark-mode QR won't scan. */}
            <div className="ring-foreground/10 flex aspect-square items-center justify-center rounded-xl bg-white p-4 ring-1">
              {generated ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(generated.svg)}`}
                  alt={`WhatsApp QR code for ${normalizeWaNumber(number)}`}
                  className="h-full w-full"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <QrCode className="size-10 text-neutral-300" />
                  <p className="max-w-40 text-xs text-neutral-400">
                    Press Generate to create your code
                  </p>
                </div>
              )}
            </div>

            {generated && (
              <>
                {/* The code on screen encodes the old message until it's
                    regenerated — say so rather than let someone print a
                    QR that doesn't match what they just typed. */}
                {stale && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <TriangleAlert className="mt-px size-3.5 shrink-0" />
                    Your message changed. This code still has the old one —
                    press Update to refresh it.
                  </p>
                )}

                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs font-medium">
                    Link
                  </p>
                  <p className="bg-muted text-muted-foreground rounded-lg px-2.5 py-2 text-xs break-all">
                    {generated.link}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={downloadPng}
                    className="border-border"
                  >
                    <Download className="size-4" />
                    PNG
                  </Button>
                  <Button
                    variant="outline"
                    onClick={downloadSvg}
                    className="border-border"
                  >
                    <Download className="size-4" />
                    SVG
                  </Button>
                </div>

                <Button onClick={copyLink} className="w-full">
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copied ? 'Copied' : 'Copy link'}
                </Button>

                <a
                  href={generated.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 text-xs transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                  Test it in WhatsApp
                </a>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
