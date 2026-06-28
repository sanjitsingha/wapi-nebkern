import { redirect } from 'next/navigation';

export default async function BroadcastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/campaigns/${id}`);
}
