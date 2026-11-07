'use server';

import { cookies } from 'next/headers';
import { serverConfig } from '@/lib/env';
import { LAUNCH_NOTICE_COOKIE } from '@/lib/service-areas';
import { requestIsSameOrigin } from '@/server/auth/origin';

/** Remembers that this browser dismissed the launch-area notice (no personal data). */
export async function dismissLaunchNotice(): Promise<void> {
  // CSRF: only Hucxter pages may set this cookie (PR #9 follow-up, Founder amendment 6).
  if (!(await requestIsSameOrigin())) return;
  const config = serverConfig();
  (await cookies()).set(LAUNCH_NOTICE_COOKIE, 'dismissed', {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction || config.appOrigin.protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}
