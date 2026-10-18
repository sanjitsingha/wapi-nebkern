import { NextResponse } from 'next/server';
import { getAdminUser } from '../../_lib/auth';
import { adminDb } from '../../_lib/admin-db';
import { encrypt, decrypt } from '@/lib/whatsapp/encryption';
import { validateAiCredentials } from '@/lib/ai/validate';
import { embedTexts } from '@/lib/ai/embeddings';
import { clearPlatformAiCache } from '@/lib/ai/platform';
import { AiError, type AiProvider } from '@/lib/ai/types';

// ============================================================
// /admin/api/ai-config — the model and paid key every account's Maya
// runs on (platform_ai_config, migration 115). Admin-only; the keys are
// stored encrypted and never returned, only whether each is set and the
// chat key's last four characters so the admin can tell which one it is.
// ============================================================

const PROVIDERS: AiProvider[] = ['openai', 'anthropic', 'openrouter'];

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

interface StoredRow {
  provider: AiProvider;
  model: string;
  api_key: string;
  embeddings_api_key: string | null;
  updated_at: string;
  updated_by: string | null;
}

async function readRow(): Promise<StoredRow | null> {
  const { data, error } = await adminDb()
    .from('platform_ai_config')
    .select('provider, model, api_key, embeddings_api_key, updated_at, updated_by')
    .eq('id', true)
    .maybeSingle();
  if (error) throw error;
  return (data as StoredRow | null) ?? null;
}

function lastFour(encrypted: string): string | null {
  try {
    return decrypt(encrypted).slice(-4);
  } catch {
    return null;
  }
}

/** Run one tiny generation with these credentials; null on success. */
async function testChat(provider: AiProvider, model: string, apiKey: string) {
  try {
    await validateAiCredentials({
      provider,
      model,
      apiKey,
      systemPrompt: null,
      isActive: true,
      autoReplyEnabled: false,
      autoReplyMaxPerConversation: 1,
      embeddingsApiKey: null,
    });
    return null;
  } catch (err) {
    if (err instanceof AiError) return err.message;
    console.error('[admin/ai-config] test error:', err);
    return 'Could not reach the provider.';
  }
}

/** GET — what is set, never the keys themselves. */
export async function GET() {
  if (!(await getAdminUser())) return bad('Unauthorized', 401);
  const row = await readRow();
  if (!row) return NextResponse.json({ configured: false });
  return NextResponse.json({
    configured: true,
    provider: row.provider,
    model: row.model,
    key_last4: lastFour(row.api_key),
    has_embeddings_key: Boolean(row.embeddings_api_key),
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  });
}

/**
 * PUT — save. Body: provider, model, api_key (optional once a key is
 * stored — omit to keep it), embeddings_api_key (string sets it, null
 * clears it, absent keeps it). The chat key is checked with the
 * provider before anything is written, and a new embeddings key with a
 * one-word embed, so a typo never takes every account's Maya down.
 */
export async function PUT(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return bad('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return bad('Invalid body');

  const provider = body.provider as AiProvider;
  if (!PROVIDERS.includes(provider)) return bad('Pick a provider.');
  const model = typeof body.model === 'string' ? body.model.trim() : '';
  if (!model) return bad('Enter a model.');

  const existing = await readRow();
  const newKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';
  let apiKey = newKey;
  if (!apiKey && existing) {
    try {
      apiKey = decrypt(existing.api_key);
    } catch {
      return bad('The stored key can’t be decrypted — enter the key again.');
    }
  }
  if (!apiKey) return bad('Enter the API key.');

  const chatError = await testChat(provider, model, apiKey);
  if (chatError) return bad(`The provider rejected it: ${chatError}`);

  const update: Record<string, unknown> = {
    id: true,
    provider,
    model,
    api_key: encrypt(apiKey),
    updated_at: new Date().toISOString(),
    updated_by: admin.email ?? null,
  };

  if (typeof body.embeddings_api_key === 'string' && body.embeddings_api_key.trim()) {
    const embeddingsKey = body.embeddings_api_key.trim();
    try {
      await embedTexts(embeddingsKey, ['ping']);
    } catch (err) {
      return bad(
        `Embeddings key: ${err instanceof AiError ? err.message : 'could not be checked.'}`
      );
    }
    update.embeddings_api_key = encrypt(embeddingsKey);
  } else if (body.embeddings_api_key === null) {
    update.embeddings_api_key = null;
  }

  const { error } = await adminDb().from('platform_ai_config').upsert(update);
  if (error) {
    console.error('[admin/ai-config] save error:', error);
    return bad('Could not save.', 500);
  }
  clearPlatformAiCache();
  return NextResponse.json({ success: true });
}

/**
 * POST — test without saving: the stored settings, or the candidate
 * provider/model/key in the body (a missing key falls back to the
 * stored one, so a model change can be tried before saving).
 */
export async function POST(request: Request) {
  if (!(await getAdminUser())) return bad('Unauthorized', 401);
  const body = (await request.json().catch(() => null)) ?? {};
  const existing = await readRow();

  const provider = (PROVIDERS.includes(body.provider) ? body.provider : existing?.provider) as
    | AiProvider
    | undefined;
  const model = (typeof body.model === 'string' && body.model.trim()) || existing?.model;
  let apiKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';
  if (!apiKey && existing) {
    try {
      apiKey = decrypt(existing.api_key);
    } catch {
      return bad('The stored key can’t be decrypted — enter the key again.');
    }
  }
  if (!provider || !model || !apiKey) return bad('Nothing to test yet.');

  const chatError = await testChat(provider, model, apiKey);
  if (chatError) return bad(chatError);
  return NextResponse.json({ ok: true });
}
