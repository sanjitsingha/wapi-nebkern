import { ProfileForm } from '@/components/settings/profile-form';
import { PlanSection } from '@/components/settings/plan-config';
import { PasswordForm } from '@/components/settings/password-form';
import { SessionsCard } from '@/components/settings/sessions-card';

// Combined "Profile" section — cards stacked directly, no left-column
// label (the section rail already tells the user where they are;
// repeating "Profile" / "Password" titles here was noise).
//
// Plan & subscription lives here too: it used to be its own rail entry,
// but the settings rail had grown too long, so it was folded in.
export default function ProfilePage() {
  return (
    <div className="animate-in fade-in-50 flex flex-col gap-6 duration-200">
      <ProfileForm />
      <PlanSection />
      <PasswordForm />
      <SessionsCard />
    </div>
  );
}
