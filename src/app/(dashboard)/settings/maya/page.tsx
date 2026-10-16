import { redirect } from 'next/navigation';

// Maya moved back out of Settings into the app sidebar, at /askmaya.
// This URL stays alive as a redirect: it was her settings rail entry,
// the dashboard's quick link and the "set up Maya" links for a while,
// so it is sitting in bookmarks.
export default function MayaSettingsRedirect() {
  redirect('/askmaya');
}
