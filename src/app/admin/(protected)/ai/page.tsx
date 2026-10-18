import { adminDb } from '../../_lib/admin-db';
import { decrypt } from '@/lib/whatsapp/encryption';
import type { AiProvider } from '@/lib/ai/types';
import {
  AiModelManager,
  type AiModelStatus,
} from '../../_components/ai-model-manager';
import { PageHeader } from '../../_components/ui';

export const dynamic = 'force-dynamic';

// Read fresh, not through cachedRead: right after a save the page must
// show what was just stored.
async function getStatus(): Promise<AiModelStatus> {
  const { data } = await adminDb()
    .from('platform_ai_config')
    .select('provider, model, api_key, embeddings_api_key, updated_at, updated_by')
    .eq('id', true)
    .maybeSingle();
  if (!data) return { configured: false };

  let keyLast4: string | null = null;
  try {
    keyLast4 = decrypt(data.api_key).slice(-4);
  } catch {
    keyLast4 = null;
  }
  return {
    configured: true,
    provider: data.provider as AiProvider,
    model: data.model,
    keyLast4,
    hasEmbeddingsKey: Boolean(data.embeddings_api_key),
    updatedAt: data.updated_at,
    updatedBy: data.updated_by,
  };
}

export default async function AdminAiModelPage() {
  const status = await getStatus();
  return (
    <>
      <PageHeader
        title="AI model"
        description="The provider, model and paid key that every account's Maya runs on — auto-replies, Reply with AI, the Playground, template writing and campaign overviews. Accounts can't see or change it."
      />
      <div className="mt-4">
        <AiModelManager status={status} />
      </div>
    </>
  );
}
