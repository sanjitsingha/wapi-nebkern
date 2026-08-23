import { redirect } from 'next/navigation';

// Maya moved into Settings → Workspace, so her surface is now a
// settings section at /settings/maya rather than a top-level page.
//
// This URL is kept alive rather than deleted: it shipped in the
// sidebar, in the walkthrough and in /docs/ai-agents, and /agents —
// the name before that — has been pointing here since the rename. Two
// dead ends for one destination is one more than anybody needs.
export default function AskMayaPage() {
  redirect('/settings/maya');
}
