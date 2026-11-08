import { cronAuthorized } from '@/server/jobs/cron-auth';
import { runJobs } from '@/server/jobs/run';
import { codeOf, logError } from '@/server/log';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request.headers.get('authorization'))) {
    return new Response('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    return Response.json(await runJobs(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logError('jobs_run_failed', { code: codeOf(error) });
    return new Response('Job run failed', {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
