import { ComingSoonCard } from '@/components/settings/coming-soon-card';

// The Instagram channel is shelved. The implementation and its
// `allowInstagram` plan gate are both intact — this page just stops
// surfacing the connect flow. Restore by wrapping <InstagramConfig />
// in the FeatureGate again and dropping `comingSoon` from SECTION_META.
export default function InstagramPage() {
  return (
    <ComingSoonCard
      label="Instagram"
      description="Instagram Direct Messages will land in your shared inbox alongside WhatsApp. We're finishing this one off."
    />
  );
}
