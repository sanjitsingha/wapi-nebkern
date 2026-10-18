'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, PlugZap } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AI_PROVIDER_DEFAULT_MODEL } from '@/lib/ai/defaults';
import type { AiProvider } from '@/lib/ai/types';
import { Panel } from './ui';
import { fmtDateTime } from '../_lib/format';

export interface AiModelStatus {
  configured: boolean;
  provider?: AiProvider;
  model?: string;
  keyLast4?: string | null;
  hasEmbeddingsKey?: boolean;
  updatedAt?: string;
  updatedBy?: string | null;
}

const PROVIDERS: { id: AiProvider; label: string; hint: string; keysUrl: string }[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    hint: 'GPT models',
    keysUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    hint: 'Claude models',
    keysUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    hint: 'Many models, one key',
    keysUrl: 'https://openrouter.ai/keys',
  },
];

/**
 * Admin → AI model: the provider, model and paid key every account's
 * Maya runs on. Saving checks the key with the provider first; the
 * change reaches every server within ~30 s.
 */
export function AiModelManager({ status }: { status: AiModelStatus }) {
  const router = useRouter();
  const [provider, setProvider] = useState<AiProvider>(status.provider ?? 'openai');
  const [model, setModel] = useState(status.model ?? AI_PROVIDER_DEFAULT_MODEL.openai);
  const [apiKey, setApiKey] = useState('');
  const [embeddingsKey, setEmbeddingsKey] = useState('');
  const [removeEmbeddings, setRemoveEmbeddings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const meta = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];
  const providerChanged = status.configured && provider !== status.provider;
  // A stored key belongs to its provider; switching provider needs a new one.
  const needsKey = !status.configured || providerChanged;

  const pickProvider = (next: AiProvider) => {
    if (next === provider) return;
    // Swap in the new provider's default unless a custom model was typed.
    const isDefault =
      !model.trim() || (Object.values(AI_PROVIDER_DEFAULT_MODEL) as string[]).includes(model);
    setProvider(next);
    if (isDefault) setModel(AI_PROVIDER_DEFAULT_MODEL[next]);
  };

  const candidate = () => ({
    provider,
    model: model.trim(),
    ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
  });

  async function test() {
    setTesting(true);
    try {
      const res = await fetch('/admin/api/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate()),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) toast.success('Connected — the provider answered.');
      else toast.error(data.error ?? 'The provider rejected it.');
    } catch {
      toast.error('Could not reach the provider.');
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    if (!model.trim()) return toast.error('Enter a model.');
    if (needsKey && !apiKey.trim()) return toast.error(`Enter the ${meta.label} API key.`);
    setSaving(true);
    try {
      const res = await fetch('/admin/api/ai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...candidate(),
          ...(embeddingsKey.trim()
            ? { embeddings_api_key: embeddingsKey.trim() }
            : removeEmbeddings
              ? { embeddings_api_key: null }
              : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success('Saved — every account’s Maya uses this within 30 seconds.');
        setApiKey('');
        setEmbeddingsKey('');
        setRemoveEmbeddings(false);
        router.refresh();
      } else {
        toast.error(data.error ?? 'Could not save.');
      }
    } catch {
      toast.error('Could not save.');
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || testing;

  return (
    <div className="max-w-2xl space-y-4">
      <Panel
        title="Status"
        actions={
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-medium',
              status.configured
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            )}
          >
            <span className="size-1.5 rounded-full bg-current" />
            {status.configured ? 'Live' : 'Not set — Maya is off for every account'}
          </span>
        }
      >
        {status.configured ? (
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Provider</dt>
            <dd className="text-foreground">
              {PROVIDERS.find((p) => p.id === status.provider)?.label}
            </dd>
            <dt className="text-muted-foreground">Model</dt>
            <dd className="text-foreground font-mono text-xs leading-5">{status.model}</dd>
            <dt className="text-muted-foreground">API key</dt>
            <dd className="text-foreground font-mono text-xs leading-5">
              {status.keyLast4 ? `•••• ${status.keyLast4}` : 'Saved (can’t be read — re-enter it)'}
            </dd>
            <dt className="text-muted-foreground">Semantic search</dt>
            <dd className="text-foreground">
              {status.hasEmbeddingsKey ? 'On' : 'Off — keyword search only'}
            </dd>
            {status.updatedAt && (
              <>
                <dt className="text-muted-foreground">Last changed</dt>
                <dd className="text-foreground">
                  {fmtDateTime(status.updatedAt)}
                  {status.updatedBy ? ` · ${status.updatedBy}` : ''}
                </dd>
              </>
            )}
          </dl>
        ) : (
          <p className="text-muted-foreground text-sm">
            Accounts can turn Maya on, but she can’t answer anyone until a provider and key
            are set here.
          </p>
        )}
      </Panel>

      <Panel title={status.configured ? 'Change' : 'Set up'}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickProvider(p.id)}
                  aria-pressed={provider === p.id}
                  className={cn(
                    'rounded-sm border px-3 py-2 text-left transition-colors',
                    provider === p.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50 border-(--admin-line)'
                  )}
                >
                  <span className="text-foreground block text-sm font-medium">{p.label}</span>
                  <span className="text-muted-foreground block text-xs">{p.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-model">Model</Label>
            <Input
              id="ai-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={AI_PROVIDER_DEFAULT_MODEL[provider]}
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs">
              The model id as the provider names it. Default for {meta.label}:{' '}
              <button
                type="button"
                onClick={() => setModel(AI_PROVIDER_DEFAULT_MODEL[provider])}
                className="text-primary font-mono hover:underline"
              >
                {AI_PROVIDER_DEFAULT_MODEL[provider]}
              </button>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-key">{meta.label} API key</Label>
            <Input
              id="ai-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                needsKey
                  ? 'Paste the key'
                  : `•••• ${status.keyLast4 ?? ''} — leave blank to keep it`
              }
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs">
              Stored encrypted and never shown again.{' '}
              <a
                href={meta.keysUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Get a {meta.label} key
              </a>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-embed">
              Embeddings key <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="ai-embed"
              type="password"
              autoComplete="off"
              value={embeddingsKey}
              onChange={(e) => {
                setEmbeddingsKey(e.target.value);
                if (e.target.value) setRemoveEmbeddings(false);
              }}
              placeholder={
                status.hasEmbeddingsKey ? 'Saved — leave blank to keep it' : 'An OpenAI key'
              }
              className="font-mono text-sm"
              disabled={removeEmbeddings}
            />
            <p className="text-muted-foreground text-xs">
              Turns on semantic search in every knowledge base. Without it, Maya searches by
              keyword.
              {status.hasEmbeddingsKey && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveEmbeddings((v) => !v);
                      setEmbeddingsKey('');
                    }}
                    className="text-red-600 hover:underline dark:text-red-400"
                  >
                    {removeEmbeddings ? 'Keep it' : 'Remove it'}
                  </button>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-(--admin-line) pt-4">
            <Button variant="outline" onClick={test} disabled={busy || (!status.configured && !apiKey.trim())}>
              {testing ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
              Test connection
            </Button>
            <Button onClick={save} disabled={busy}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
