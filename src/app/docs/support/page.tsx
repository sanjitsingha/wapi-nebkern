import type { Metadata } from 'next';

import {
  DocsArticle,
  DocsHero,
  DocsPager,
} from '@/components/docs/docs-components';

export const metadata: Metadata = { title: 'Support & walkthrough' };

export default function SupportDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Help"
        title="Support & walkthrough"
        description="Reach our team directly, and revisit the guided tour whenever you need a refresher."
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

        <h2>The guided walkthrough</h2>
        <p>
          New accounts get a short guided tour the first time they land in
          the app, pointing out the inbox, contacts, campaigns, automation,
          AI agents, connecting WhatsApp, and support — the handful of
          places worth knowing on day one. Skip it anytime, and replay it
          whenever you like from the <strong>Walkthrough</strong> button in
          the sidebar footer, right above Support.
        </p>
      </DocsArticle>

      <DocsPager slug="support" />
    </>
  );
}
