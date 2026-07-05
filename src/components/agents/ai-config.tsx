'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Sparkles,
  Brain,
  Route,
  CheckCircle2,
  Trash2,
  Eye,
  EyeOff,
  Check,
  KeyRound,
  MessageSquareText,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AI_PROVIDER_DEFAULT_MODEL } from '@/lib/ai/defaults';
import type { AiProvider } from '@/lib/ai/types';
import { AiKnowledgeCard } from './ai-knowledge';

const MASKED_KEY = '••••••••••••••••';

interface ProviderMeta {
  id: AiProvider;
  label: string;
  tagline: string;
  icon: LucideIcon;
  placeholder: string;
  keysUrl: string;
  free?: boolean;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    tagline: 'GPT models',
    icon: Sparkles,
    placeholder: 'sk-...',
    keysUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    tagline: 'Claude models',
    icon: Brain,
    placeholder: 'sk-ant-...',
    keysUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    tagline: 'Free & paid models',
    icon: Route,
    placeholder: 'sk-or-...',
    keysUrl: 'https://openrouter.ai/keys',
    free: true,
  },
];

function providerMeta(id: AiProvider): ProviderMeta {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

export function AiConfig({ onSaved }: { onSaved?: () => void }) {
  const { accountId, accountRole, profileLoading } = useAuth();
  const canEdit = accountRole ? canEditSettings(accountRole) : false;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [configured, setConfigured] = useState(false);
  const [provider, setProvider] = useState<AiProvider>('openai');
  const [model, setModel] = useState(AI_PROVIDER_DEFAULT_MODEL.openai);
  const [apiKey, setApiKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [embeddingsKey, setEmbeddingsKey] = useState('');
  const [embeddingsKeyEdited, setEmbeddingsKeyEdited] = useState(false);
  const [hasStoredEmbeddingsKey, setHasStoredEmbeddingsKey] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [maxPerConversation, setMaxPerConversation] = useState(3);

  // Guard keyed on the account (not a bare boolean) so an in-place
  // account switch — ownership transfer, multi-account membership —
  // refetches instead of showing the previous account's config.
  const loadedAccountIdRef = useRef<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/config');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to load AI configuration');
        return;
      }
      if (data.configured) {
        setConfigured(true);
        setProvider(data.provider);
        setModel(data.model);
        setSystemPrompt(data.system_prompt ?? '');
        setIsActive(data.is_active);
        setAutoReplyEnabled(Boolean(data.auto_reply_enabled));
        setMaxPerConversation(data.auto_reply_max_per_conversation ?? 3);
        setHasStoredKey(Boolean(data.has_key));
        setApiKey(data.has_key ? MASKED_KEY : '');
        setKeyEdited(false);
        setHasStoredEmbeddingsKey(Boolean(data.has_embeddings_key));
        setEmbeddingsKey(data.has_embeddings_key ? MASKED_KEY : '');
        setEmbeddingsKeyEdited(false);
      }
    } catch {
      toast.error('Failed to load AI configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!accountId || loadedAccountIdRef.current === accountId) return;
    loadedAccountIdRef.current = accountId;
    void fetchConfig();
  }, [accountId, fetchConfig]);

  // Swap the model default when the provider changes, unless the user
  // typed a custom model.
  const handleProviderChange = (next: AiProvider) => {
    if (next === provider) return;
    setProvider(next);
    const isDefaultModel =
      (Object.values(AI_PROVIDER_DEFAULT_MODEL) as string[]).includes(model) ||
      model.trim() === '';
    if (isDefaultModel) setModel(AI_PROVIDER_DEFAULT_MODEL[next]);
  };

  const keyPayload = () => (keyEdited ? apiKey.trim() : undefined);

  // undefined = leave unchanged; '' typed = null (clear); text = set.
  const embeddingsKeyPayload = () =>
    embeddingsKeyEdited ? embeddingsKey.trim() || null : undefined;

  const buildBody = () => ({
    provider,
    model: model.trim(),
    api_key: keyPayload(),
    embeddings_api_key: embeddingsKeyPayload(),
    system_prompt: systemPrompt.trim() || null,
    is_active: isActive,
    // Auto-reply can't be on without the master switch; the bot's own
    // gate also checks isActive, but keep the persisted state coherent.
    auto_reply_enabled: isActive && autoReplyEnabled,
    auto_reply_max_per_conversation: maxPerConversation,
  });

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model: model.trim(),
          api_key: keyPayload(),
        }),
      });
      const data = await res.json();
      if (res.ok) toast.success('Key works — the provider responded.');
      else toast.error(data.error ?? 'The provider rejected the request.');
    } catch {
      toast.error('Could not reach the provider.');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!model.trim()) {
      toast.error('Enter a model name.');
      return;
    }
    if (!configured && !keyEdited) {
      toast.error('Enter your API key.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody()),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('AI assistant saved.');
        await fetchConfig();
        onSaved?.();
      } else {
        toast.error(data.error ?? 'Failed to save.');
      }
    } catch {
      toast.error('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove the AI configuration and forget the key?')) return;
    setRemoving(true);
    try {
      const res = await fetch('/api/ai/config', { method: 'DELETE' });
      if (res.ok) {
        toast.success('AI configuration removed.');
        setConfigured(false);
        setHasStoredKey(false);
        setApiKey('');
        setKeyEdited(false);
        setHasStoredEmbeddingsKey(false);
        setEmbeddingsKey('');
        setEmbeddingsKeyEdited(false);
        setIsActive(false);
        setAutoReplyEnabled(false);
        setMaxPerConversation(3);
        setSystemPrompt('');
        onSaved?.();
      } else {
        const data = await res.json();
        toast.error(data.error ?? 'Failed to remove.');
      }
    } catch {
      toast.error('Failed to remove.');
    } finally {
      setRemoving(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const disabled = !canEdit || saving;
  const active = providerMeta(provider);

  return (
    <div className="space-y-5">
      {!canEdit && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
          Only admins and owners can change the AI configuration.
        </p>
      )}

      {/* ── Provider & key ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <KeyRound className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">
              Model provider
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Bring your own key — we call the provider directly, so there are no
              per-seat AI fees. Your key is encrypted (AES-256-GCM) and never
              shown again after saving.
            </p>
          </div>
        </div>

        {/* Provider tiles */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {PROVIDERS.map((p) => {
            const selected = p.id === provider;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleProviderChange(p.id)}
                disabled={disabled}
                aria-pressed={selected}
                className={cn(
                  'group relative flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60',
                  selected
                    ? 'border-primary bg-primary-soft/50 ring-1 ring-primary'
                    : 'border-border bg-background hover:border-primary/40 hover:bg-muted/50',
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span
                    className={cn(
                      'flex size-9 items-center justify-center rounded-lg transition-colors',
                      selected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground group-hover:text-foreground',
                    )}
                  >
                    <p.icon className="h-4.5 w-4.5" />
                  </span>
                  {selected ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : p.free ? (
                    <span className="rounded-full border border-emerald-600/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                      Free
                    </span>
                  ) : null}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {p.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {p.tagline}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Model + key */}
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ai-model">Model</Label>
            <Input
              id="ai-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={AI_PROVIDER_DEFAULT_MODEL[provider]}
              disabled={disabled}
              className="h-11 font-mono text-sm"
            />
            {provider === 'openrouter' ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Pick a{' '}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">
                  :free
                </code>{' '}
                model to pay nothing.{' '}
                <a
                  href="https://openrouter.ai/models?max_price=0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary hover:underline"
                >
                  Browse free models <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                The exact model ID from {active.label}. Editable — swap for a
                cheaper or newer one anytime.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="ai-key">API key</Label>
              <a
                href={active.keysUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
              >
                Get a {active.label} key <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Input
                  id="ai-key"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setKeyEdited(true);
                  }}
                  onFocus={() => {
                    if (!keyEdited && hasStoredKey) {
                      setApiKey('');
                      setKeyEdited(true);
                    }
                  }}
                  placeholder={active.placeholder}
                  disabled={disabled}
                  autoComplete="off"
                  className="h-11 pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={disabled || testing}
                className="h-11 shrink-0 sm:w-32"
              >
                {testing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Test key
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-embeddings-key">
              Embeddings key{' '}
              <span className="font-normal text-muted-foreground">
                (optional — enables semantic knowledge-base search)
              </span>
            </Label>
            <Input
              id="ai-embeddings-key"
              type="password"
              value={embeddingsKey}
              onChange={(e) => {
                setEmbeddingsKey(e.target.value);
                setEmbeddingsKeyEdited(true);
              }}
              onFocus={() => {
                if (!embeddingsKeyEdited && hasStoredEmbeddingsKey) {
                  setEmbeddingsKey('');
                  setEmbeddingsKeyEdited(true);
                }
              }}
              placeholder="sk-... (OpenAI)"
              disabled={disabled}
              autoComplete="off"
              className="h-11 font-mono text-sm"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              An OpenAI key used only to embed your knowledge base
              (text-embedding-3-small)
              {provider === 'openai' ? ' — can be the same key as above' : ''}.
              Leave blank to use keyword search. Clear it to turn semantic
              search off.
            </p>
          </div>
        </div>
      </section>

      {/* ── Behaviour ──────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <MessageSquareText className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Behaviour</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Tell the assistant about your business — products, tone, what it may
              and may not promise. This context feeds every reply.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ai-prompt">Business context &amp; instructions</Label>
            <Textarea
              id="ai-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="e.g. We are Acme, a coffee-equipment store. Be warm and concise. Never quote prices or delivery dates — hand off to a human for those."
              rows={5}
              disabled={disabled}
              className="resize-none leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Enable AI assistant
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Master switch for AI features across the workspace. The Playground
                works even while this is off, so you can test first.
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Auto-reply to inbound messages
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                The bot answers new inbound messages automatically — only when no
                flow handles them and no agent is assigned. It hands off to a
                human when it can&apos;t confidently help.
              </p>
            </div>
            <Switch
              checked={autoReplyEnabled}
              onCheckedChange={setAutoReplyEnabled}
              disabled={disabled || !isActive}
            />
          </div>

          <div className="flex items-center justify-between gap-4 pl-1">
            <div className="min-w-0">
              <Label htmlFor="ai-max">Max auto-replies per conversation</Label>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                After this many bot replies in one thread, the bot goes quiet.
              </p>
            </div>
            <Input
              id="ai-max"
              type="number"
              min={1}
              max={20}
              value={maxPerConversation}
              onChange={(e) =>
                setMaxPerConversation(
                  Math.min(20, Math.max(1, Number(e.target.value) || 1)),
                )
              }
              disabled={disabled || !isActive || !autoReplyEnabled}
              className="h-11 w-20 shrink-0"
            />
          </div>
        </div>
      </section>

      {/* ── Knowledge base ─────────────────────────────────────── */}
      <AiKnowledgeCard
        accountId={accountId}
        canEdit={canEdit}
        hasEmbeddingsKey={
          embeddingsKeyEdited
            ? embeddingsKey.trim().length > 0
            : hasStoredEmbeddingsKey
        }
      />

      {/* ── Actions ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        {configured ? (
          <Button
            variant="ghost"
            onClick={handleRemove}
            disabled={!canEdit || removing}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {removing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Remove
          </Button>
        ) : (
          <span />
        )}

        <Button onClick={handleSave} disabled={disabled} className="h-11 px-8">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {configured ? 'Save changes' : 'Save & activate'}
        </Button>
      </div>
    </div>
  );
}
