import { ProfileForm } from '@/components/settings/profile-form';
import { PasswordForm } from '@/components/settings/password-form';
import { SessionsCard } from '@/components/settings/sessions-card';

// Combined "Profile & security" section — cards stacked directly, no
// left-column label (the section rail already tells the user where
// they are; repeating "Profile" / "Password" titles here was noise).
export default function ProfilePage() {
  return (
    <div className="animate-in fade-in-50 flex flex-col gap-6 duration-200">
      <ProfileForm />
      <PasswordForm />
      <SessionsCard />
    </div>
  );
}
