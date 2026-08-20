import { redirect } from 'next/navigation';

// The AI agent surface moved to /askmaya when the assistant was named
// Maya. Keep the old URL working: it shipped in the sidebar, in
// /docs/ai-agents, and in the walkthrough, so it is sitting in
// bookmarks and in anything already linked externally.
export default function AgentsPage() {
  redirect('/askmaya');
}
