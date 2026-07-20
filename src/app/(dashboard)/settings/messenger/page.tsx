import { ComingSoonCard } from '@/components/settings/coming-soon-card';

// The Messenger channel is shelved. The implementation is intact
// (components/settings/messenger-config.tsx, /api/messenger/*) — this
// page just stops surfacing the connect flow, so nobody can start an
// OAuth handshake for a channel we aren't supporting yet. Restore by
// rendering <MessengerConfig /> under a Suspense boundary again (it
// reads ?fb_* params via useSearchParams) and dropping `comingSoon`
// from SECTION_META.
export default function MessengerPage() {
  return (
    <ComingSoonCard
      label="Messenger"
      description="Facebook Messenger conversations will land in your shared inbox alongside WhatsApp. We're finishing this one off."
    />
  );
}
