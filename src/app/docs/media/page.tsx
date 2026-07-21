import type { Metadata } from 'next';
import Link from 'next/link';

import {
  DocsArticle,
  DocsCallout,
  DocsFieldTable,
  DocsHero,
  DocsPager,
} from '@/components/docs/docs-components';

export const metadata: Metadata = { title: 'Media library' };

export default function MediaDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Growth"
        title="Media library"
        description="Upload images, video, and documents once, reuse them anywhere you send media."
      />

      <DocsArticle>
        <p>
          The Media Library is a shared account-wide store for files you
          reuse — most usefully, a template header image you don&apos;t want to
          re-upload every time you edit that template. It&apos;s separate from
          the files attached inline in an individual inbox message, which
          upload straight into that conversation.
        </p>

        <h2>Supported files and limits</h2>
        <DocsFieldTable
          columns={['Type', 'Formats', 'Max size']}
          rows={[
            { cells: ['Image', 'JPEG, PNG', '5 MB'] },
            { cells: ['Video', 'MP4, 3GPP', '16 MB'] },
            { cells: ['Document', 'PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT', '16 MB'] },
          ]}
        />
        <p>
          These limits match what WhatsApp&apos;s Cloud API itself accepts, so a
          file that uploads here will also be usable in a template or a
          message without hitting a size wall later.
        </p>

        <DocsCallout type="info">
          Uploads count against your plan&apos;s storage allowance. If
          you&apos;re near the limit, an upload may be rejected — see{' '}
          <Link href="/docs/billing">Billing &amp; plans</Link> for what each plan
          includes.
        </DocsCallout>

        <h2>Where it&apos;s used</h2>
        <ul>
          <li>
            Picking a header image or video when building a message
            template, instead of uploading fresh each time.
          </li>
          <li>The &ldquo;Send media&rdquo; step when building a Flow.</li>
        </ul>
        <p>
          Deleting an item from the library removes the stored file as well
          as its entry — anything already sent using it (a past message, an
          already-submitted template) is unaffected.
        </p>
      </DocsArticle>

      <DocsPager slug="media" />
    </>
  );
}
