'use server';

import { cookies } from 'next/headers';
import { serverConfig } from '@/lib/env';
import { LAUNCH_NOTICE_COOKIE } from '@/lib/service-areas';

/** Remembers that this browser dismissed the launch-area notice (no personal data). */
export async function dismissLaunchNotice(): Promise<void> {
  const config = serverConfig();
  (await cookies()).set(LAUNCH_NOTICE_COOKIE, 'dismissed', {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction || config.appOrigin.protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}
