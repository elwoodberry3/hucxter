import { notFound } from 'next/navigation';
import { getViewer } from '@/lib/viewer';

/** Admin console placeholder. Hidden (404) for everyone who isn't staff; role check in Brief 03. */
export default async function AdminPage() {
  const viewer = await getViewer();
  if (viewer.kind !== 'member' || !viewer.isStaff) notFound();
  return <h1>Admin</h1>;
}
