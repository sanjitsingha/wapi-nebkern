import { redirect } from 'next/navigation';

// "Fields & tags" became two pages, Tags and Custom fields
// (settings-sections.ts). Kept as a redirect so old links still land.
export default function CustomizationPage() {
  redirect('/settings/tags');
}
