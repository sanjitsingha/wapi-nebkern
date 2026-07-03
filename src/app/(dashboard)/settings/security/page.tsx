import { redirect } from 'next/navigation';

// Security merged into the combined "Profile & security" section.
// Keep the old URL working for bookmarks and external links.
export default function SecurityPage() {
  redirect('/settings/profile');
}
