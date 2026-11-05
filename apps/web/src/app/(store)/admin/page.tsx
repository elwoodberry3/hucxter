import { requireStaff } from '@/server/auth/gate';

/** Admin console placeholder. 404 for everyone but verified staff, checked on every request. */
export default async function AdminPage() {
  await requireStaff();
  return <h1>Admin</h1>;
}
