import { redirect } from 'next/navigation';

// Settings → AI behaviour (once "AI & models", before that "Developer
// hub") is gone: every Maya setting lives in Maya's own pages now, and
// the model and key are Dripo's (Admin → AI model). Kept as a redirect
// so old links and bookmarks still land somewhere useful.
export default function DeveloperHubPage() {
  redirect('/askmaya');
}
