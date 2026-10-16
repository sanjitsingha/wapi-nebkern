import { redirect } from 'next/navigation';

// The original name for this surface, from before the assistant was
// called Maya. It goes straight to her page, /askmaya.
export default function AgentsPage() {
  redirect('/askmaya');
}
