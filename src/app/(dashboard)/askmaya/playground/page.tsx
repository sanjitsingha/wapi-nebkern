'use client';

import { useEffect, useState } from 'react';

import { AiPlayground } from '@/components/agents/ai-playground';
import { SettingsPanelHead } from '@/components/settings/settings-panel-head';

/** Maya → Playground: chat with her before she talks to customers. */
export default function MayaPlaygroundPage() {
  // Whether Instant's AI is ready; assumed until the config says not.
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai/config')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setConfigured(Boolean(data?.configured));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <SettingsPanelHead
        title="Playground"
        description="Chat with Maya as a customer would — with your business context and knowledge base. Nothing here reaches WhatsApp."
      />
      <AiPlayground configured={configured} />
    </section>
  );
}
