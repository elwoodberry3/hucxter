import { HealthResponse } from '@hucxter/contracts';
import { serverConfig } from '@/lib/env';
import packageJson from '../../../../package.json';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  const body = HealthResponse.parse({
    status: 'ok',
    version: packageJson.version,
    commit: serverConfig().commit,
  });
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
