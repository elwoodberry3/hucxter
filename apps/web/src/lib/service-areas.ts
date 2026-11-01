import 'server-only';
import { Zip } from '@hucxter/contracts';
import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { publicDb } from './supabase';

export const LAUNCH_NOTICE_COOKIE = 'hx_launch_notice';

async function launchAreaNames(): Promise<string[]> {
  const { data, error } = await publicDb()
    .from('service_areas')
    .select('name')
    .eq('is_launch', true)
    .order('name')
    .limit(20);
  if (error) throw new Error(`Failed to load service areas: ${error.message}`);
  return z
    .array(z.object({ name: z.string() }))
    .parse(data)
    .map((row) => row.name);
}

async function inLaunchArea(zip: string): Promise<boolean> {
  const response = await publicDb().rpc('in_launch_area', { p_zip: zip });
  if (response.error) throw new Error('in_launch_area failed');
  return z.boolean().parse(response.data);
}

const cachedNames = unstable_cache(launchAreaNames, ['launch-area-names-v1'], { revalidate: 3600 });
const cachedInLaunchArea = unstable_cache(inLaunchArea, ['in-launch-area-v1'], {
  revalidate: 3600,
});

/**
 * The launch-area notice to show for a ZIP (D-35), or null when the ZIP is inside a launch area.
 * Location never blocks anything; this is information only.
 */
export async function launchNoticeFor(zip: string | null): Promise<string | null> {
  if (zip === null || !Zip.safeParse(zip).success) return null;
  if (await cachedInLaunchArea(zip)) return null;
  const names = await cachedNames();
  if (names.length === 0) return null;
  return `Hucxter is starting in ${names.join(' and ')}. You can still browse and post here.`;
}
