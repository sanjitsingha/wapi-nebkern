'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  Loader2,
  Save,
  TriangleAlert,
} from 'lucide-react';

import { useCan } from '@/hooks/use-can';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DEFAULT_WIDGET_CONFIG,
  WIDGET_LIMITS,
  isHexColor,
  type WidgetConfig,
} from '@/lib/widget/config';
import { SettingsPanelHead } from './settings-panel-head';
import { WidgetPreview } from './chat-widget-preview';

/** Delay options, in seconds. `''` is the "never" sentinel for the Select. */
const AUTO_OPEN_OPTIONS = [
  { value: '', label: 'Never open by itself' },
  { value: '3', label: 'After 3 seconds' },
  { value: '5', label: 'After 5 seconds' },
  { value: '10', label: 'After 10 seconds' },
  { value: '30', label: 'After 30 seconds' },
];

interface LoadedState {
  config: WidgetConfig;
  publicKey: string | null;
  snippet: string | null;
  connectedPhone: string;
  stalePhone: boolean;
}

export function ChatWidget() {
  const canEdit = useCan('edit-settings');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState<LoadedState | null>(null);
  const [config, setConfig] = useState<WidgetConfig>(DEFAULT_WIDGET_CONFIG);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/widget/config');
      if (!res.ok) throw new Error('load failed');
      const data = await res.json();
      setState({
        config: data.config,
        publicKey: data.publicKey ?? null,
        snippet: data.snippet ?? null,
        connectedPhone: data.connectedPhone ?? '',
        stalePhone: !!data.stalePhone,
      });
      setConfig(data.config);
    } catch {
      toast.error('Could not load widget settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/widget/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Could not save widget settings');
        return;
      }
      setConfig(data.config);
      setState((prev) =>
        prev
          ? {
              ...prev,
              config: data.config,
              publicKey: data.publicKey,
              snippet: data.snippet,
              stalePhone: false,
            }
          : prev,
      );
      toast.success('Widget saved');
    } catch {
      toast.error('Could not save widget settings');
    } finally {
      setSaving(false);
    }
  }

  async function copySnippet() {
    if (!state?.snippet) return;
    await navigator.clipboard.writeText(state.snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function set<K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="text-primary size-6 animate-spin" />
      </div>
    );
  }

  const connected = !!state?.connectedPhone;
  const colorValid = isHexColor(config.brandColor);

  return (
    <div className="animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title="Chat Widget"
        description="A WhatsApp chat bubble you can drop onto any website with one line of code. Visitors click it and land in a chat with you, with their first message already written."
        action={
          <Button onClick={save} disabled={!canEdit || saving || !connected}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save changes
          </Button>
        }
      />

      {!connected && (
        <Alert className="mb-5">
          <TriangleAlert />
          <AlertTitle>No WhatsApp number connected</AlertTitle>
          <AlertDescription>
            The widget sends visitors to your connected WhatsApp Business
            number. Connect one in{' '}
            <Link href="/settings/whatsapp">Settings → WhatsApp</Link> before
            publishing.
          </AlertDescription>
        </Alert>
      )}

      {connected && state?.stalePhone && (
        <Alert className="mb-5">
          <TriangleAlert />
          <AlertTitle>Connected number has changed</AlertTitle>
          <AlertDescription>
            The live widget still points at the number saved earlier. Save again
            to update it to {state.connectedPhone}.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ---- Settings ------------------------------------------------ */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-foreground text-sm font-medium">
                    Show the widget
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    Turn this off to hide the bubble everywhere without removing
                    the code from your site.
                  </p>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(v) => set('enabled', !!v)}
                  disabled={!canEdit}
                  aria-label="Show the widget"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-5">
              <p className="text-foreground text-sm font-semibold">Appearance</p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="w-name">Business name</Label>
                  <Input
                    id="w-name"
                    value={config.businessName}
                    maxLength={WIDGET_LIMITS.businessName}
                    disabled={!canEdit}
                    onChange={(e) => set('businessName', e.target.value)}
                    placeholder="Acme Ltd"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="w-tagline">Subtitle</Label>
                  <Input
                    id="w-tagline"
                    value={config.tagline}
                    maxLength={WIDGET_LIMITS.tagline}
                    disabled={!canEdit}
                    onChange={(e) => set('tagline', e.target.value)}
                    placeholder="Typically replies within minutes"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="w-greeting">Greeting</Label>
                <Textarea
                  id="w-greeting"
                  value={config.greeting}
                  maxLength={WIDGET_LIMITS.greeting}
                  disabled={!canEdit}
                  rows={3}
                  onChange={(e) => set('greeting', e.target.value)}
                  placeholder="Hi there! How can we help you today?"
                />
                <p className="text-muted-foreground text-xs">
                  Shown in the panel before the visitor opens WhatsApp.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="w-message">Their first message</Label>
                <Textarea
                  id="w-message"
                  value={config.prefilledMessage}
                  maxLength={WIDGET_LIMITS.prefilledMessage}
                  disabled={!canEdit}
                  rows={2}
                  onChange={(e) => set('prefilledMessage', e.target.value)}
                  placeholder="Hi! I'd like to know more."
                />
                <p className="text-muted-foreground text-xs">
                  Pre-typed into the visitor&apos;s WhatsApp so they only have to
                  press send. Leave empty for a blank chat.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="w-color">Brand colour</Label>
                  <div className="flex items-center gap-2">
                    {/* The native colour input can only ever emit valid
                        hex, but the text field next to it accepts typing,
                        so both feed the same validated state. */}
                    <input
                      type="color"
                      aria-label="Pick brand colour"
                      value={colorValid ? config.brandColor : '#25D366'}
                      disabled={!canEdit}
                      onChange={(e) => set('brandColor', e.target.value)}
                      className="border-border h-9 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
                    />
                    <Input
                      id="w-color"
                      value={config.brandColor}
                      disabled={!canEdit}
                      aria-invalid={!colorValid || undefined}
                      onChange={(e) => set('brandColor', e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  {!colorValid && (
                    <p className="text-destructive text-xs">
                      Use a hex colour like #25D366.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="w-placement">Position</Label>
                  <Select
                    value={config.placement}
                    onValueChange={(v) =>
                      set('placement', v === 'left' ? 'left' : 'right')
                    }
                    disabled={!canEdit}
                  >
                    <SelectTrigger id="w-placement">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="right">Bottom right</SelectItem>
                      <SelectItem value="left">Bottom left</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-5">
              <p className="text-foreground text-sm font-semibold">Behaviour</p>

              <div className="space-y-2">
                <Label htmlFor="w-autoopen">Open automatically</Label>
                <Select
                  value={
                    config.autoOpenDelaySeconds === null
                      ? ''
                      : String(config.autoOpenDelaySeconds)
                  }
                  onValueChange={(v) =>
                    set('autoOpenDelaySeconds', v ? Number(v) : null)
                  }
                  disabled={!canEdit}
                >
                  <SelectTrigger id="w-autoopen">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTO_OPEN_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Happens at most once per browsing session, and never after the
                  visitor has closed the panel.
                </p>
              </div>

              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="w-desktop" className="font-normal">
                  Show on desktop
                </Label>
                <Switch
                  id="w-desktop"
                  checked={config.showOnDesktop}
                  onCheckedChange={(v) => set('showOnDesktop', !!v)}
                  disabled={!canEdit}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="w-mobile" className="font-normal">
                  Show on mobile
                </Label>
                <Switch
                  id="w-mobile"
                  checked={config.showOnMobile}
                  onCheckedChange={(v) => set('showOnMobile', !!v)}
                  disabled={!canEdit}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ---- Preview + snippet --------------------------------------- */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div>
            <p className="text-foreground mb-2 text-sm font-semibold">Preview</p>
            <WidgetPreview config={config} />
          </div>

          <div>
            <p className="text-foreground mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Code2 className="size-4" />
              Install
            </p>
            {state?.snippet ? (
              <>
                <p className="text-muted-foreground mb-2 text-xs">
                  Paste this just before the closing{' '}
                  <code className="bg-muted rounded px-1 py-0.5">
                    &lt;/body&gt;
                  </code>{' '}
                  tag on every page you want the bubble on.
                </p>
                <pre className="bg-muted text-muted-foreground overflow-x-auto rounded-lg p-3 text-[11px] leading-relaxed">
                  <code>{state.snippet}</code>
                </pre>
                <Button
                  variant="outline"
                  onClick={copySnippet}
                  className="border-border mt-2 w-full"
                >
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copied ? 'Copied' : 'Copy snippet'}
                </Button>
                <a
                  href={state.snippet.match(/src="([^"]+)"/)?.[1] ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground mt-2 flex items-center justify-center gap-1.5 text-xs transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                  View the served script
                </a>
              </>
            ) : (
              <p className="text-muted-foreground border-border rounded-lg border border-dashed p-4 text-xs">
                Save once to generate your install snippet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
