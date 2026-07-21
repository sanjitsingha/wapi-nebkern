import type { Metadata } from 'next';
import Link from 'next/link';

import {
  DocsArticle,
  DocsFieldTable,
  DocsHero,
  DocsPager,
} from '@/components/docs/docs-components';

export const metadata: Metadata = { title: 'Account settings' };

export default function AccountSettingsDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Account"
        title="Account settings"
        description="Your profile, security, and the account-wide customization options that don't have a bigger home elsewhere."
      />

      <DocsArticle>
        <h2>Profile</h2>
        <p>
          Set your display name and avatar, and change the email address on
          your login (confirmed on both the old and new address before it
          takes effect). Your role and how long you&rsquo;ve been a member
          are shown here too, read-only.
        </p>

        <h2>Security</h2>
        <p>
          Change your password by confirming the current one first. A
          &ldquo;sign out everywhere&rdquo; option ends every active session
          on every device at once — useful if you suspect a device is
          compromised or just left logged in somewhere you don&rsquo;t
          control anymore.
        </p>

        <h2>Business profile</h2>
        <p>
          This is your <strong>WhatsApp</strong> business profile — about
          text, description, address, email, websites, category, and photo.
          See <Link href="/docs/whatsapp">WhatsApp channel</Link> for the
          field-by-field detail and character limits.
        </p>

        <h2>Customization</h2>
        <p>Two things live here that don&rsquo;t belong to any one feature page:</p>
        <DocsFieldTable
          columns={['Tab', 'What it holds']}
          rows={[
            { cells: ['Fields & tags', 'Your tag list, and any custom contact fields you’ve defined — used across contacts, segments, and automations.'] },
            { cells: ['Deals & currency', 'Your account’s default currency for new deals.'] },
          ]}
        />
        <p>
          Deal <strong>stage</strong> customization (adding/renaming/
          reordering stages) doesn&rsquo;t live in Settings at all — it&rsquo;s
          on each pipeline&rsquo;s own settings panel. See{' '}
          <Link href="/docs/pipelines">Pipelines &amp; deals</Link>.
        </p>
      </DocsArticle>

      <DocsPager slug="account-settings" />
    </>
  );
}
