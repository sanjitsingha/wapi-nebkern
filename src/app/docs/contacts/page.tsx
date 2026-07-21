import type { Metadata } from 'next';
import Link from 'next/link';

import {
  DocsArticle,
  DocsCallout,
  DocsFieldTable,
  DocsHero,
  DocsPager,
} from '@/components/docs/docs-components';

export const metadata: Metadata = { title: 'Contacts' };

export default function ContactsDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Conversations & CRM"
        title="Contacts"
        description="Every person you've messaged or imported, with the fields, tags, and custom data your CRM needs."
      />

      <DocsArticle>
        <h2>What&apos;s on a contact</h2>
        <p>
          A contact needs at least one way to reach them — a phone number, an
          Instagram id, or a Messenger id — everything else is optional:
        </p>
        <DocsFieldTable
          rows={[
            { cells: ['Name, email, company', 'Free text — the basics.'] },
            { cells: ['Phone', 'Stored alongside a normalized, digits-only version used for matching and deduplication.'] },
            { cells: ['Date of birth', 'ISO date.'] },
            { cells: ['Marital status / spouse name', 'Spouse name only applies when marital status is set to Married.'] },
            { cells: ['Address', 'Street, locality, city, state, and PIN code as separate fields.'] },
            { cells: ['Marketing opt-out', 'When set, excludes the contact from campaign targeting — see Segments below.'] },
            { cells: ['Spam / muted / blocked', 'Flags you can set from the contact panel to quiet a contact down without deleting them.'] },
          ]}
        />

        <h2>Custom fields</h2>
        <p>
          Beyond the built-in fields, an admin can define{' '}
          <strong>custom fields</strong> for your account — under{' '}
          <strong>Settings → Customization</strong> — each with its own name
          and type. Every contact then carries one value per custom field.
          Custom fields also show up as filterable options when building a
          segment, with a smaller set of operators (equals, contains, is
          set/not set) since their values are stored as text.
        </p>

        <h2>Tags</h2>
        <p>
          Tags are a many-to-many label you attach to contacts — the same
          tag can sit on any number of contacts, and a contact can carry
          several tags. Tags are usable both as an inbox filter and as a
          segment rule.
        </p>

        <h2>Duplicate handling</h2>
        <p>
          wacrm matches phone numbers by their normalized, digits-only form
          (tolerant of a missing or extra leading trunk digit, e.g. a leading
          0), so the same person can&apos;t quietly end up as two separate
          contacts just because a number was typed with or without a
          country/trunk prefix.
        </p>
        <ul>
          <li>
            Creating a contact by hand <strong>blocks</strong> an exact
            duplicate phone number outright.
          </li>
          <li>
            A close-but-not-exact match (a likely duplicate) shows a{' '}
            <strong>warning</strong> instead of blocking you, in case
            it&apos;s genuinely a different person.
          </li>
        </ul>

        <h2>Importing contacts by CSV</h2>
        <p>
          From the Contacts page, import a CSV with a required{' '}
          <code>phone</code> column, plus any of <code>name</code>,{' '}
          <code>email</code>, <code>company</code>, and <code>tags</code> as
          optional columns. On import, wacrm:
        </p>
        <ul>
          <li>De-duplicates rows within the file itself by phone number.</li>
          <li>Skips numbers that already exist in your account.</li>
          <li>
            Checks the new rows against your plan&apos;s contact limit before
            importing.
          </li>
          <li>
            Creates any tag named in the <code>tags</code> column that
            doesn&apos;t already exist — only when the person importing has admin
            access; otherwise unrecognized tag names are left off.
          </li>
          <li>
            Imports in batches; if one batch fails, it retries row-by-row so
            a single bad row doesn&apos;t block the rest of the file.
          </li>
        </ul>
        <DocsCallout type="info">
          There&apos;s no CSV export today, and import doesn&apos;t add
          contacts directly into a List — add imported contacts to a list
          afterward from the list&apos;s own page. See{' '}
          <Link href="/docs/segments-and-lists">Segments &amp; lists</Link>.
        </DocsCallout>

        <p>
          Need to remove several contacts at once? Select them from the
          Contacts page and use bulk delete.
        </p>
      </DocsArticle>

      <DocsPager slug="contacts" />
    </>
  );
}
