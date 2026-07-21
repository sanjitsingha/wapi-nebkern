import type { Metadata } from 'next';
import Link from 'next/link';

import {
  DocsArticle,
  DocsCallout,
  DocsFieldTable,
  DocsHero,
  DocsPager,
} from '@/components/docs/docs-components';

export const metadata: Metadata = { title: 'Message templates' };

export default function TemplatesDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Growth"
        title="Message templates"
        description="Pre-approved message formats — required for anything sent outside the 24-hour reply window, and for every campaign."
      />

      <DocsArticle>
        <p>
          WhatsApp requires any message you send outside the 24-hour customer
          reply window — and every bulk{' '}
          <Link href="/docs/campaigns">campaign</Link> message — to use a
          template that Meta has reviewed and approved in advance. wacrm&apos;s
          template builder puts that structure together for you and submits
          it for review.
        </p>

        <h2>Categories</h2>
        <p>
          Every template is one of three categories, which Meta uses to
          decide how it&apos;s reviewed and billed:
        </p>
        <ul>
          <li><strong>Marketing</strong> — promotions, announcements, offers.</li>
          <li><strong>Utility</strong> — order updates, appointment reminders, account notices.</li>
          <li>
            <strong>Authentication</strong> — one-time passcodes; the body
            text is generated automatically by Meta rather than written by
            you.
          </li>
        </ul>

        <h2>Structure</h2>
        <p>
          A template is built from an optional <strong>header</strong>{' '}
          (text, image, video, or document), a required{' '}
          <strong>body</strong>, an optional <strong>footer</strong>, and
          optional <strong>buttons</strong>. Variables use WhatsApp&apos;s{' '}
          <code>{'{{1}}'}</code>, <code>{'{{2}}'}</code>… placeholders and
          must be numbered contiguously starting at 1.
        </p>
        <DocsFieldTable
          rows={[
            { cells: ['Body', '1,024 characters', 'Can contain any number of {{n}} variables.'] },
            { cells: ['Header (text)', '60 characters', 'At most one variable, and it must be {{1}}.'] },
            { cells: ['Footer', '60 characters', 'No variables allowed.'] },
            { cells: ['Buttons', 'Up to 10 total', '25 characters each; see button types below.'] },
          ]}
        />

        <h3>Buttons</h3>
        <p>
          Available types: <strong>Quick Reply</strong> (a canned response the
          customer taps), <strong>URL</strong> (up to 2, may carry one{' '}
          <code>{'{{1}}'}</code> variable in the link), <strong>Phone
          number</strong> (one), and <strong>Copy code</strong> (one).
          Authentication templates instead use a single dedicated{' '}
          <strong>OTP</strong> button. If you mix Quick Reply buttons with
          URL/phone/copy-code buttons, the Quick Reply ones must come first.
        </p>

        <h3>Carousels</h3>
        <p>
          Marketing templates can also be built as a carousel of 2–10 cards;
          every card must use the same media type (all image or all video)
          and carry the same set of buttons.
        </p>

        <h2>Language</h2>
        <p>
          Set the template&apos;s language (defaults to <code>en_US</code>) — you
          can create the same template in multiple languages if you serve
          customers in more than one.
        </p>

        <h2>Review and approval</h2>
        <p>
          Submitting a template sends it to Meta for review. Status moves
          through:
        </p>
        <DocsFieldTable
          columns={['Status', 'Meaning']}
          rows={[
            { cells: ['Draft', 'Not yet submitted.'] },
            { cells: ['Pending', 'Submitted, awaiting Meta’s review.'] },
            { cells: ['Approved', 'Ready to send and use in campaigns.'] },
            { cells: ['Rejected', 'Meta declined it — a reason is shown so you can fix and resubmit.'] },
            { cells: ['Paused / Disabled', 'Meta has temporarily or permanently suspended it, usually for quality reasons.'] },
          ]}
        />
        <p>
          A template&apos;s <strong>quality rating</strong> (green/yellow/red)
          reflects how recipients have responded to it over time and is
          updated automatically as Meta re-scores it.
        </p>
        <DocsCallout type="info">
          Editing an approved, rejected, or paused template resets its status
          to Pending for re-review — you can&apos;t tweak a live template
          without Meta looking at it again. Authentication templates can&apos;t be edited
          here at all; delete and recreate them instead.
        </DocsCallout>
      </DocsArticle>

      <DocsPager slug="templates" />
    </>
  );
}
