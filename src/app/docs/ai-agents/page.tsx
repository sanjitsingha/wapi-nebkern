import type { Metadata } from 'next';
import Link from 'next/link';

import {
  DocsArticle,
  DocsCallout,
  DocsFieldTable,
  DocsHero,
  DocsPager,
} from '@/components/docs/docs-components';

export const metadata: Metadata = { title: 'AI agents' };

export default function AiAgentsDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Automation & AI"
        title="AI agents"
        description="An AI trained on your own knowledge base, replying to routine questions and handing off the rest."
      />

      <DocsArticle>
        <h2>Setting it up</h2>
        <p>
          Under <strong>AI Agents</strong>, choose a provider and model, and
          write a system prompt describing your business — what you sell,
          your policies, your tone. A master switch turns the agent on or
          off for the whole account, and a separate toggle controls whether
          it auto-replies to customers versus only being available for
          drafting.
        </p>

        <h2>Knowledge base</h2>
        <p>
          Add documents — FAQs, policies, product details — and the agent
          draws on them when answering. Each document is broken into
          smaller chunks and, when configured with an embeddings key,
          searched semantically (by meaning, not just keyword) so a
          differently-worded question can still find the right answer; a
          keyword-based search fills in alongside it either way.
        </p>

        <h2>The playground</h2>
        <p>
          Test the agent in a private chat before it ever talks to a real
          customer — same prompt, same knowledge base, same model, no
          messages sent anywhere. Useful for checking a prompt change or a
          new knowledge document actually changes how it answers before you
          trust it with live conversations.
        </p>

        <h2>When it actually replies</h2>
        <p>
          Auto-reply only fires when nothing else already has a claim on the
          conversation:
        </p>
        <ul>
          <li>A human teammate isn&rsquo;t already assigned to the thread.</li>
          <li>
            No <Link href="/docs/automations">automation</Link> is already
            set to answer this message.
          </li>
          <li>
            The conversation hasn&rsquo;t already hit its per-conversation
            reply cap (configurable, so the agent can&rsquo;t loop
            indefinitely on one thread) — unless it&rsquo;s been explicitly
            assigned to that conversation, which lifts the cap.
          </li>
        </ul>
        <p>
          It also waits a few seconds after a customer stops typing before
          replying, so a burst of several quick messages gets answered once,
          not once per message.
        </p>

        <h2>Handing off to a human</h2>
        <p>
          When the agent can&rsquo;t confidently help — a question outside
          its knowledge base, something that needs a judgment call — it
          hands the conversation off rather than guessing. The conversation
          then surfaces as unassigned in the inbox for your team to pick up.
        </p>

        <h2>Assigning the AI to one conversation</h2>
        <p>
          Beyond the account-wide auto-reply setting, you can assign your AI
          agent to a specific conversation directly from the inbox — the
          same way you&rsquo;d assign a teammate or a{' '}
          <Link href="/docs/flows">Flow</Link>. Only one of the three can
          own a conversation at a time.
        </p>

        <DocsFieldTable
          columns={['Configurable', 'Notes']}
          rows={[
            { cells: ['Provider & model', 'OpenAI, Anthropic, or OpenRouter — pick the one you have an API key for.'] },
            { cells: ['System prompt', 'Your business context — what shapes every reply.'] },
            { cells: ['Auto-reply cap', 'Max automatic replies per conversation before it stands down and waits for a human.'] },
            { cells: ['Knowledge base', 'Documents the agent can draw on when answering.'] },
          ]}
        />

        <DocsCallout type="tip" title="Drafting instead of auto-sending">
          Don&rsquo;t want the AI replying on its own at all? Leave
          auto-reply off and use the composer&rsquo;s <strong>AI
          draft</strong> button instead — it writes a suggested reply for a
          teammate to review and send, on any conversation, on demand.
        </DocsCallout>
      </DocsArticle>

      <DocsPager slug="ai-agents" />
    </>
  );
}
