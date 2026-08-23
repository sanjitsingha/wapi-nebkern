import { redirect } from 'next/navigation';

// The original name for this surface, from before the assistant was
// called Maya. It pointed at /askmaya through the rename; now that the
// page has moved into Settings it goes straight to its real home
// instead of bouncing through a second redirect on the way.
export default function AgentsPage() {
  redirect('/settings/maya');
}
