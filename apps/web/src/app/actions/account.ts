'use server';

import { redirect } from 'next/navigation';
import { requestIsSameOrigin } from '@/server/auth/origin';
import { sessionClient } from '@/server/supabase-server';

/** Signs out this browser only (revokes this session server-side and clears its cookies). */
export async function signOut(): Promise<void> {
  if (!(await requestIsSameOrigin())) redirect('/');
  const supabase = await sessionClient();
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/');
}
