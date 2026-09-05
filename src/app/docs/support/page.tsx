import type { Metadata } from 'next';

import {
  DocsArticle,
  DocsHero,
  DocsPager,
} from '@/components/docs/docs-components';

export const metadata: Metadata = { title: 'Support' };

export default function SupportDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Help"
        title="Support"
        description="Reach our team directly whenever you need a hand."
      />

      <DocsArticle>
        <h2>Support tickets</h2>
        <p>
          Open <strong>Support</strong> from the sidebar footer to start a
          ticket — pick a category (general, billing, technical, feature
          request, or other) and a priority, describe what&rsquo;s going on,
          and our team replies right there in the same thread. Each ticket
          gets a short reference code so it&rsquo;s easy to refer back to. A
          small dot appears on the Support icon whenever there&rsquo;s an
          unread reply waiting for you.
        </p>
      </DocsArticle>

      <DocsPager slug="support" />
    </>
  );
}
